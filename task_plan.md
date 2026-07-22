# task_plan.md — fix-zalo-crm-mvp-gaps

Plan persistent theo planning-with-files + writing-plans. Theo doi tien do dot MVP-gap.
Spec chinh: openspec/changes/fix-zalo-crm-mvp-gaps/{proposal,tasks,design}.md + 9 spec con trong specs/.
Quy tac kiem tra: dung verification-before-completion — chay lenh verify, dan output vao progress.md truoc khi tick [x].

## Trang thai

| Capability | File spec | Trang thai | Commit |
|------------|-----------|------------|--------|
| 0. Moi truong + pre-check | tasks.md §0 | DONE (DB co 125 bang, migration file chua commit) | _ |
| 1. AI 9router connectivity | specs/ai-9router-connectivity/spec.md | TODO | _ |
| 2. Automation menu trong Reports | specs/automation-report-menu/spec.md | TODO | _ |
| 7. Group scan scroll | specs/group-scan-scroll/spec.md | TODO | _ |
| 9. Template create confirm | specs/template-create-confirm/spec.md | TODO | _ |
| 4. Scoring rules editable | specs/scoring-rules-edit/spec.md | TODO | _ |
| 5. System sender config | specs/system-sender-config/spec.md | TODO | _ |
| 6. Chat AI + Follow-up sequence | specs/chat-ai-followup/spec.md | TODO | _ |
| 3. Lead Pool FIFO | specs/lead-pool-fifo/spec.md | TODO | _ |
| 8. Broadcast polish | specs/broadcast-polish/spec.md | TODO | _ |

Thu tu tiep theo: 1 → 2 → 7 → 9 → 4 → 5 → 6 → 3 → 8. Commit 1 commit / capability sau khi verify pass.

## Acceptance tong (Gate G4 cuoi dot)

- [ ] Tat ca 10 acceptance scenario o proposal.md "Tieu chi hoan thanh dot" pass.
- [ ] npm run typecheck (frontend) khong loi.
- [ ] npm run test --workspace backend pass.
- [ ] docker compose -f docker-compose.dev.yml build app thanh cong.
- [ ] prisma migrate status khong con pending.

## Mapping file → capability

Xem chi tiet o design.md "Tong ket file can dung".

## Cach dung file nay

1. Moi lan chuyen task: tick trang thai o bang tren, ghi progress.md.
2. Khi verify pass: tao commit va dan sha vao cot "Commit".
3. Phat hien moi: ghi vao findings.md, khong sua spec ma khong hoi user.
