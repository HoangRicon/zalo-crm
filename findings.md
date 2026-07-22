# findings.md — fix-zalo-crm-mvp-gaps

Ghi lai moi phat hien trong qua trinh trien khai: code path khac spec, schema thieu, env thieu, ket qua test khong nhu ky vong. KHONG sua spec tai day — moi de xuat sua phai quay lai hoi user truoc khi ap dung.

## Format

```
### YYYY-MM-DD — Capability #N — <tieu de ngan>
- Phat hien: <quan sat cu the>
- Bang chung: <lenh / log / file:line>
- De xuat: <sua spec / giu nguyen / bo sung>  ←  can user xac nhan
- Trang thai: open / resolved
```

---

### 2026-07-23 00:05 — Capability #0 — Lenh giua tasks.md/spec va thuc te moi truong

- Phat hien: tasks.md §0 va design.md §0 viet prisma migrate status ngay trong container, nhung thuc te:
  1. Container app mount ./backend/src thay vi ./backend → ben trong container khong thay prisma/schema.prisma.
  2. DB user trong container khong phai "zalo" nhu spec ghi → thuc te la "crmuser" (theo docker-compose.dev.yml line 21, 55).
  3. Comment o docker-compose.dev.yml line 34: "prisma folder NOT mounted to preserve UTF-8 encoded schema.prisma from Docker image".
- Bang chung: output cac lenh docker exec.
- De xuat (DA AP DUNG): chay prisma tren host tu backend/, su dung DATABASE_URL inline tro vao DB container qua 127.0.0.1:5433.
- Trang thai: resolved.

### 2026-07-23 00:08 — Capability #0 — DB thieu nhieu bang can cho cac capability ve sau

- Phat hien: Khi exec docker exec zalo-crm-db psql de check cac bang theo tasks.md §0:
  - KHONG ton tai bang _prisma_migrations → DB chua tung chay qua Prisma migrate.
  - THIEU: scheduled_template_sends, sequence_memberships, auto_reply_rules, automation_execution_logs (4 bang can cho capability #6).
- Bang chung: query information_schema truoc khi fix.
- De xuat (DA AP DUNG): dung prisma migrate diff --from-config-datasource --to-schema de sinh SQL bo sung → copy vao container qua docker cp → psql -f. Khong mat du lieu, khong xung dot.
- Trang thai: resolved. 4 bang da duoc tao, tong so bang tu 121 len 125.

### 2026-07-23 00:10 — Capability #0 — Quy uoc moi cho prisma commands

- Phat hien: db push ngam (silent exit 0) khi Prisma 7 + schema dong bo voi DB → khong ro push co chay hay khong.
- Quy uoc moi: moi lenh prisma se chay tren host tu thu muc backend, voi DATABASE_URL inline. Verify bang psql truc tiep trong container.
- Trang thai: ongoing convention.
