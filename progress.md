# progress.md — fix-zalo-crm-mvp-gaps

Nhat ky tien do, 1 entry moi capability hoan thanh. Moi entry phai kem output verify (gate G4).

---

## Capability #0 — Env pre-check + DB schema (2026-07-23 00:10)

- Commit: chua commit (chi chay lenh ap dung SQL truc tiep len DB container)
- Files touched:
  - backend/prisma/migrations/20260723000000_mvp_gaps_extra_tables/migration.sql (CREATE, 123 dong) — chua commit vi user chua duyet commit Capability #0
  - findings.md, task_plan.md, progress.md
- Verify output:
  - docker exec zalo-crm-db psql -U crmuser -d zalocrm -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'": truoc=121, sau=125 (+4).
  - 4 bang moi: auto_reply_rules, automation_execution_logs, scheduled_template_sends, sequence_memberships.
  - FK + index cho 4 bang moi da tao thanh cong (output psql khong loi).
- Acceptance scenarios pass: N/A (pre-check).
- Van de da xu ly:
  - DB thieu cac bang EE/automation. Nguyen nhan: DB cu duoc init bang db push hoac import SQL, chua tung chay Prisma migrate.
  - Giai phap: prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script de sinh SQL bo sung, copy vao container qua docker cp, apply bang psql -f. Khong xung dot.
- Van de con lai (xem findings.md):
  - .env khong co san tren host — moi lenh prisma can inject DATABASE_URL inline.
  - docker-compose.dev.yml mount ./backend/src thay vi ./backend, container khong thay prisma/ ? tu gio moi lenh prisma chay tren host tu thu muc backend/.
