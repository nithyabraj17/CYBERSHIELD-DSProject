/*
 * CYBERSHIELD engine (C). Node.js runs this program once per request:
 *     engine <datafile.csv> <command> [args]
 * All data-structure logic lives here and results are printed as JSON.
 *
 *   Queue       : new/loaded logs wait here, processed first in, first out
 *   Linked list : every processed log record
 *   Hash table  : per-IP and per-user counters (separate chaining)
 *   BST         : IPs ordered numerically, used for search and sorted view
 *   Stack       : most recent events (newest on top)
 *
 * Commands: list | add ip user status | addbulk (CSV lines on stdin) | delete id
 *           summary [failLimit] [freqLimit] | search ip | sorted | recent
 *
 * Build:  gcc -Wall -Wextra -o engine engine.c
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <time.h>

#define IP_LEN 16
#define USER_LEN 32
#define HASH_SIZE 53

typedef struct Log {                         /* linked list node */
    int id;
    char ip[IP_LEN], user[USER_LEN], status[8], time[24];
    struct Log *next;
} Log;
typedef struct QNode { Log *log; struct QNode *next; } QNode;   /* queue node */
typedef struct SNode { Log *log; struct SNode *next; } SNode;   /* stack node */
typedef struct IpRec { char ip[IP_LEN]; int total, failed, success; struct IpRec *next; } IpRec;
typedef struct UserRec { char user[USER_LEN]; int total, failed; struct UserRec *next; } UserRec;
typedef struct BNode { unsigned long key; IpRec *rec; struct BNode *left, *right; } BNode;

static char dataFile[512];
static Log *head = NULL, *tail = NULL;
static int logCount = 0, nextId = 1;
static QNode *qFront = NULL, *qRear = NULL;
static SNode *stackTop = NULL;
static IpRec *ipTable[HASH_SIZE];
static UserRec *userTable[HASH_SIZE];
static BNode *root = NULL;

/* ---------- JSON helpers ---------- */
static void jsonStr(const char *s) {
    putchar('"');
    for (; *s; s++) {
        unsigned char c = (unsigned char)*s;
        if (c == '"' || c == '\\') { putchar('\\'); putchar(c); }
        else if (c < 0x20) printf("\\u%04x", c);
        else putchar(c);
    }
    putchar('"');
}
static int fail(int code, const char *msg) {
    printf("{\"error\":"); jsonStr(msg); printf("}\n");
    return code;
}
static void printLog(const Log *l) {
    printf("{\"id\":%d,\"ip\":", l->id); jsonStr(l->ip);
    printf(",\"user\":"); jsonStr(l->user);
    printf(",\"status\":"); jsonStr(l->status);
    printf(",\"time\":"); jsonStr(l->time); putchar('}');
}
static void printIpRec(const IpRec *r) {
    printf("{\"ip\":"); jsonStr(r->ip);
    printf(",\"total\":%d,\"failed\":%d,\"success\":%d}", r->total, r->failed, r->success);
}

/* ---------- validation ---------- */
static int normalizeIp(const char *in, char *out) {
    int a, b, c, d; char extra;
    if (sscanf(in, "%d.%d.%d.%d%c", &a, &b, &c, &d, &extra) != 4) return 0;
    if (a < 0 || a > 255 || b < 0 || b > 255 || c < 0 || c > 255 || d < 0 || d > 255) return 0;
    snprintf(out, IP_LEN, "%d.%d.%d.%d", a, b, c, d);
    return 1;
}
static unsigned long ipToNum(const char *ip) {
    int a, b, c, d;
    sscanf(ip, "%d.%d.%d.%d", &a, &b, &c, &d);
    return (((unsigned long)a * 256 + b) * 256 + c) * 256 + d;
}
static const char *normalizeStatus(const char *s) {
    if (tolower((unsigned char)s[0]) == 's') return "Success";
    if (tolower((unsigned char)s[0]) == 'f') return "Failed";
    return NULL;
}
static int validUser(const char *u) {
    size_t n = strlen(u);
    if (n < 1 || n >= USER_LEN) return 0;
    for (; *u; u++) if (!isalnum((unsigned char)*u) && !strchr("_-.@ ", *u)) return 0;
    return 1;
}
static int validTime(const char *t) {
    size_t n = strlen(t);
    if (n < 1 || n >= sizeof(((Log *)0)->time)) return 0;
    for (; *t; t++) if (!isalnum((unsigned char)*t) && !strchr("-: /T.", *t)) return 0;
    return 1;
}

/* ---------- hash table ---------- */
static unsigned hashStr(const char *s) {
    unsigned h = 5381;
    while (*s) h = h * 33 + (unsigned char)*s++;
    return h % HASH_SIZE;
}
static IpRec *getIp(const char *ip) {
    unsigned h = hashStr(ip);
    for (IpRec *r = ipTable[h]; r; r = r->next) if (!strcmp(r->ip, ip)) return r;
    IpRec *r = calloc(1, sizeof *r);
    if (!r) exit(fail(1, "Out of memory."));
    strcpy(r->ip, ip); r->next = ipTable[h]; ipTable[h] = r;
    return r;
}
static UserRec *getUser(const char *user) {
    unsigned h = hashStr(user);
    for (UserRec *u = userTable[h]; u; u = u->next) if (!strcmp(u->user, user)) return u;
    UserRec *u = calloc(1, sizeof *u);
    if (!u) exit(fail(1, "Out of memory."));
    snprintf(u->user, USER_LEN, "%s", user); u->next = userTable[h]; userTable[h] = u;
    return u;
}

/* ---------- binary search tree ---------- */
static BNode *bstInsert(BNode *n, IpRec *rec) {
    unsigned long k = ipToNum(rec->ip);
    if (!n) {
        n = calloc(1, sizeof *n);
        if (!n) exit(fail(1, "Out of memory."));
        n->key = k; n->rec = rec; return n;
    }
    if (k < n->key) n->left = bstInsert(n->left, rec);
    else if (k > n->key) n->right = bstInsert(n->right, rec);
    return n;
}
static IpRec *bstSearch(BNode *n, unsigned long k) {
    while (n) { if (k == n->key) return n->rec; n = k < n->key ? n->left : n->right; }
    return NULL;
}
static int firstItem;
static void bstInorder(BNode *n) {
    if (!n) return;
    bstInorder(n->left);
    if (!firstItem) putchar(',');
    firstItem = 0;
    printIpRec(n->rec);
    bstInorder(n->right);
}

/* ---------- queue -> list + indexes + stack ---------- */
static int enqueueLog(int id, const char *ip, const char *user, const char *status, const char *when) {
    char cip[IP_LEN]; const char *st;
    if (!normalizeIp(ip, cip) || !validUser(user) || !(st = normalizeStatus(status))) return 0;
    Log *l = calloc(1, sizeof *l); QNode *q = calloc(1, sizeof *q);
    if (!l || !q) exit(fail(1, "Out of memory."));
    if (id > 0) { l->id = id; if (id >= nextId) nextId = id + 1; } else l->id = nextId++;
    strcpy(l->ip, cip); snprintf(l->user, USER_LEN, "%s", user); strcpy(l->status, st);
    if (when && validTime(when)) snprintf(l->time, sizeof l->time, "%s", when);
    else { time_t t = time(NULL); strftime(l->time, sizeof l->time, "%Y-%m-%d %H:%M:%S", localtime(&t)); }
    q->log = l;
    if (qRear) qRear->next = q; else qFront = q;
    qRear = q;
    return 1;
}
static void indexLog(const Log *l) {
    IpRec *r = getIp(l->ip); UserRec *u = getUser(l->user);
    r->total++; u->total++;
    if (l->status[0] == 'F') { r->failed++; u->failed++; } else r->success++;
    root = bstInsert(root, r);
}
static void processQueue(void) {
    while (qFront) {
        QNode *q = qFront; Log *l = q->log;
        qFront = q->next; if (!qFront) qRear = NULL;
        free(q);
        l->next = NULL;
        if (tail) tail->next = l; else head = l;
        tail = l; logCount++;
        indexLog(l);
        SNode *s = calloc(1, sizeof *s);
        if (!s) exit(fail(1, "Out of memory."));
        s->log = l; s->next = stackTop; stackTop = s;
    }
}

/* ---------- file handling (id,ip,user,status,time) ---------- */
static void loadFile(void) {
    FILE *f = fopen(dataFile, "r");
    if (!f) return;
    char line[256];
    while (fgets(line, sizeof line, f)) {
        int id; char ip[64], user[64], st[32], when[32] = "";
        line[strcspn(line, "\r\n")] = '\0';
        if (sscanf(line, "%d,%63[^,],%63[^,],%31[^,],%31[^\n]", &id, ip, user, st, when) >= 4)
            enqueueLog(id, ip, user, st, when);
    }
    fclose(f);
    processQueue();
}
static int saveFile(void) {
    char tmp[540];
    snprintf(tmp, sizeof tmp, "%s.tmp", dataFile);
    FILE *f = fopen(tmp, "w");
    if (!f) return 0;
    fprintf(f, "id,ip,user,status,time\n");
    for (Log *l = head; l; l = l->next) fprintf(f, "%d,%s,%s,%s,%s\n", l->id, l->ip, l->user, l->status, l->time);
    if (fclose(f) != 0) return 0;
    remove(dataFile);                         /* needed on Windows, harmless elsewhere */
    return rename(tmp, dataFile) == 0;
}

/* ---------- commands ---------- */
static int cmpIp(const void *a, const void *b) {
    const IpRec *x = *(IpRec *const *)a, *y = *(IpRec *const *)b;
    if (y->total != x->total) return y->total - x->total;
    return strcmp(x->ip, y->ip);
}
static void alertJson(const char *level, const char *target, const char *reason) {
    if (!firstItem) putchar(',');
    firstItem = 0;
    printf("{\"level\":\"%s\",\"target\":", level); jsonStr(target);
    printf(",\"reason\":"); jsonStr(reason); putchar('}');
}

static int cmdList(void) {
    printf("[");
    for (Log *l = head; l; l = l->next) { printLog(l); if (l->next) putchar(','); }
    printf("]\n");
    return 0;
}

static int cmdAdd(int argc, char **argv) {
    if (argc < 6 || !enqueueLog(0, argv[3], argv[4], argv[5], NULL))
        return fail(1, "Need a valid IPv4 ip, a user (letters, digits, _-.@ space; max 31) and status Success or Failed.");
    processQueue();
    if (!saveFile()) return fail(1, "Could not save the data file.");
    printLog(tail); putchar('\n');
    return 0;
}

static int cmdAddBulk(void) {
    char line[256]; int before = logCount, n = 0;
    while (fgets(line, sizeof line, stdin)) {
        char ip[64], user[64], st[32], when[32] = "";
        line[strcspn(line, "\r\n")] = '\0';
        if (!line[0]) continue;
        int got = sscanf(line, "%63[^,],%63[^,],%31[^,],%31[^\n]", ip, user, st, when);
        if (got < 3 || !enqueueLog(0, ip, user, st, when))
            return fail(1, "One or more rows are invalid; nothing was saved.");
        n++;
    }
    processQueue();
    if (!saveFile()) return fail(1, "Could not save the data file.");
    printf("[");
    int i = 0;
    for (Log *l = head; l; l = l->next, i++)
        if (i >= before) { printLog(l); if (i < before + n - 1) putchar(','); }
    printf("]\n");
    return 0;
}

static int cmdDelete(char *arg) {
    char *end; long id = strtol(arg, &end, 10);
    if (*end || id < 1) return fail(1, "Invalid id.");
    Log *prev = NULL, *cur = head;
    while (cur && cur->id != id) { prev = cur; cur = cur->next; }
    if (!cur) return fail(2, "Log not found.");
    if (prev) prev->next = cur->next; else head = cur->next;
    if (cur == tail) tail = prev;
    if (!saveFile()) return fail(1, "Could not save the data file.");
    printf("{\"deleted\":%ld}\n", id);
    return 0;
}

static int cmdSummary(int argc, char **argv) {
    int failLimit = argc > 3 ? atoi(argv[3]) : 3, freqLimit = argc > 4 ? atoi(argv[4]) : 5;
    if (failLimit < 1) failLimit = 3;
    if (freqLimit < 1) freqLimit = 5;
    int bad = 0, n = 0, k = 0;
    for (Log *l = head; l; l = l->next) if (l->status[0] == 'F') bad++;
    for (int i = 0; i < HASH_SIZE; i++) for (IpRec *r = ipTable[i]; r; r = r->next) n++;
    IpRec **top = malloc((n ? n : 1) * sizeof *top);
    if (!top) return fail(1, "Out of memory.");
    for (int i = 0; i < HASH_SIZE; i++) for (IpRec *r = ipTable[i]; r; r = r->next) top[k++] = r;
    qsort(top, n, sizeof *top, cmpIp);

    printf("{\"total\":%d,\"success\":%d,\"failed\":%d,\"topIps\":[", logCount, logCount - bad, bad);
    for (int i = 0; i < n; i++) { if (i) putchar(','); printIpRec(top[i]); }
    printf("],\"alerts\":[");
    firstItem = 1;
    char why[128];
    for (int i = 0; i < HASH_SIZE; i++) {
        for (IpRec *r = ipTable[i]; r; r = r->next) {
            if (r->failed >= failLimit) {
                snprintf(why, sizeof why, "%d failed logins (limit %d): repeated failed attempts", r->failed, failLimit);
                alertJson("High", r->ip, why);
            } else if (r->total >= freqLimit) {
                snprintf(why, sizeof why, "%d attempts (limit %d): unusual login frequency", r->total, freqLimit);
                alertJson("Medium", r->ip, why);
            }
        }
        for (UserRec *u = userTable[i]; u; u = u->next)
            if (u->failed >= failLimit) {
                snprintf(why, sizeof why, "%d failed logins on this account", u->failed);
                alertJson("High", u->user, why);
            }
    }
    printf("],\"note\":\"Alerts are suspicious patterns to investigate, not confirmed attacks.\"}\n");
    free(top);
    return 0;
}

static int cmdSearch(char *arg) {
    char ip[IP_LEN];
    if (!normalizeIp(arg, ip)) return fail(1, "Invalid IP address.");
    IpRec *r = bstSearch(root, ipToNum(ip));          /* BST search */
    if (!r) { printf("{\"found\":false,\"logs\":[]}\n"); return 0; }
    printf("{\"found\":true,\"ip\":"); jsonStr(r->ip);
    printf(",\"total\":%d,\"failed\":%d,\"success\":%d,\"logs\":[", r->total, r->failed, r->success);
    int first = 1;
    for (Log *l = head; l; l = l->next)
        if (!strcmp(l->ip, ip)) { if (!first) putchar(','); first = 0; printLog(l); }
    printf("]}\n");
    return 0;
}

static int cmdSorted(void) {
    printf("["); firstItem = 1; bstInorder(root); printf("]\n");
    return 0;
}

static int cmdRecent(void) {
    printf("[");
    int i = 0;
    for (SNode *s = stackTop; s && i < 5; s = s->next, i++) { if (i) putchar(','); printLog(s->log); }
    printf("]\n");
    return 0;
}

int main(int argc, char **argv) {
    if (argc < 3) return fail(1, "Usage: engine <datafile> <command> [args]");
    snprintf(dataFile, sizeof dataFile, "%s", argv[1]);
    const char *cmd = argv[2];
    loadFile();
    if (!strcmp(cmd, "list")) return cmdList();
    if (!strcmp(cmd, "add")) return cmdAdd(argc, argv);
    if (!strcmp(cmd, "addbulk")) return cmdAddBulk();
    if (!strcmp(cmd, "delete") && argc > 3) return cmdDelete(argv[3]);
    if (!strcmp(cmd, "summary")) return cmdSummary(argc, argv);
    if (!strcmp(cmd, "search") && argc > 3) return cmdSearch(argv[3]);
    if (!strcmp(cmd, "sorted")) return cmdSorted();
    if (!strcmp(cmd, "recent")) return cmdRecent();
    return fail(1, "Unknown command.");
}
