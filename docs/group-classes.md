# 그룹수업 운영 안내

기존 NTAC 훈련과 PT 예약·횟수권·일지를 유지하면서 그룹수업을 추가했습니다. 운톡과 자동으로 연동하지 않습니다. 그룹 예약·공식 출석·이용권 차감은 운톡에서 처리합니다. 기존 NTAC의 체크인 표시는 출석과 혼동하지 않도록 ‘컨디션 기록’으로 바뀌었습니다.

## 처음 시작하기

1. **관리 → 그룹수업 → 회원 · 기준 중량**에서 그룹 이용 회원을 등록합니다. NTAC/PT 이용 권한은 바뀌지 않습니다.
2. **수업 운영 → 수업 만들기**에서 날짜·시간·코치·프로그램을 입력합니다. 추천/기록할 운동만 핵심 운동으로 추가합니다.
3. 중량 운동은 표준 종목, 목표 반복 수, kg/lb, 바 포함 총중량/덤벨 한 손 기준을 지정합니다. 수행 방식이 다르면 별도 표준 종목으로 등록합니다.
4. 프로그램을 공개하고 **수업 당일 참가 접수 열기**를 누릅니다.
5. 회원은 **그룹수업 → 수업 선택 → 오늘 운동 시작**을 누릅니다. 코치는 **참가자 추가**로 여러 명을 등록할 수 있습니다. 두 경로의 참가 정보는 하나로 합쳐집니다.
6. 회원 또는 코치가 실제 수행 기록을 입력합니다. 수치 없이 운동 완료도 가능합니다. 수업 전체 종료는 참가자 자동 완료가 아닙니다.
7. 코치는 **기록 · 추천 조정**에서 중량·난이도 조정과 기록 확정을 합니다. 그룹 완료는 PT 차감이나 NTAC 과제 완료에 영향을 주지 않습니다.

## 추천 중량과 기록

- 추천은 같은 종목·반복 수·단위·중량 기준·난이도로 **최근 90일 이내 코치가 확정한 그룹수업의 실제 완료 기록**을 우선 사용합니다. 반복 목표를 달성한 기록만 사용하며 자동 증량은 하지 않습니다.
- 해당 기록이 없으면 관리자가 설정한 기준 중량을 사용합니다. 둘 다 없으면 **코치 확인**입니다.
- 참가 시 추천을 고정합니다. 기준 중량을 나중에 바꿔도 진행 중 수업의 추천은 덮어쓰지 않습니다. 코치가 직접 조정하고 이유를 남길 수 있습니다.
- 현재 PT 자유문장 일지나 기존 NTAC 기록에서 중량을 추측해 가져오지 않습니다. 추후 표준 종목으로 구조화된 데이터 연결이 필요합니다.
- 추천과 실제 기록은 별개입니다. 실제 입력은 비어 있으며 회원이 **추천대로 수행했어요**를 눌러야 복사됩니다.
- 기록 형식: 중량·반복, 시간(초), 라운드·추가 반복, 거리(m), 칼로리, 참여. 미입력과 0을 구분합니다.
- 회원은 수업 종료 후 24시간까지 수정할 수 있습니다. 코치 확정 후에는 코치만 수정/확정 해제할 수 있습니다. 다른 기기의 변경과 충돌하면 새로 불러오도록 안내합니다.
- 나의 기록은 최근 200개 참가 내역이며, 취소 수업과 미완료 참가를 완료 횟수에서 제외합니다. 그룹·PT·NTAC의 기존 통계는 각 서비스 안에서 유지합니다.
- 참가자가 생긴 수업의 프로그램은 고정됩니다. 변경된 프로그램은 새 수업으로 복제합니다.

## TV 두 화면

1. **TV 연결 → TV 연결 만들기**에서 TV 묶음을 만듭니다.
2. **TV 1 · 추천 중량**, **TV 2 · 결과 보드** 링크를 각각 해당 TV의 브라우저나 웹 앱 실행 기기에서 엽니다.
3. 수업 운영에서 수업을 열고 **이 수업 TV 송출 → 이 수업을 두 화면에 송출**을 누릅니다. 운동 선택도 두 화면에 같이 적용됩니다.
4. TV는 5초 간격으로 서버 내용을 확인합니다. 9명씩 표시하고 8초마다 다음 페이지로 넘어갑니다. 연결 지연 시 마지막 화면이라는 표시가 뜹니다.
5. 회원의 **TV 표시** 설정은 기본 비공개입니다. 회원이 별명을 입력하고 공개에 동의해야 TV에 표시됩니다. 이메일·연락처·메모·PT 횟수·원래 프로필 ID는 TV API가 반환하지 않습니다.
6. 링크는 90일 동안 유효한 읽기 전용 연결입니다. TV에 관리자 로그인을 하지 않습니다. 링크를 다시 만들려면 기존 연결을 해제하고 새 TV 묶음을 만듭니다.

일반 모니터만으로 웹 앱을 실행할 수는 없습니다. 각 화면에 웹 앱을 열 수 있는 스마트 TV 기능 또는 호환 HDMI 실행 기기가 필요합니다. 아이패드는 운영 화면을 제어합니다. 실제 설치 기기와 현장 Wi-Fi에서의 검증은 별도입니다.

결과 화면은 같은 수업 프로그램·운동·난이도 안에서 확정된 완료 기록만 비교합니다. 중량은 목표 반복 수가 정확히 같은 경우에만 순위에 포함합니다. 미완주·미입력·확정 전 결과는 순위를 붙이지 않습니다. 추가 중량이나 장비 조건이 다른 시간/거리 운동은 별도 종목·핵심 운동으로 구분해야 합니다.

## 권한과 데이터

- 그룹 이용 권한은 `group_members`에서 별도로 관리합니다. 기존 회원에게 자동으로 그룹 이용 권한을 부여하지 않습니다.
- 일반 코치는 본인 담당 수업만 운영합니다. 전체 그룹 권한·기준 중량·TV 연결은 관리자에게 한정합니다.
- 그룹 미등록 회원의 한 수업 예외 참가는 관리자만 허용할 수 있습니다. 실제 계정이 있어야 합니다.
- 이용 중지 후에도 본인 그룹 참가 기록을 볼 수 있습니다. 새로운 참가는 차단됩니다.
- 회원 배정 화면은 PT 담당 코치와 NTAC 담당 코치를 별도로 저장합니다. 기존 `set_member_services`는 캐시된 구버전 호환을 위해 남겨 두고 신규 화면은 `set_member_services_v2`를 사용합니다.
- 클래스 프로그램/참가/추천/결과/변경 이력/TV 토큰은 새 테이블에 저장합니다. PT·NTAC의 기존 기록 ID나 데이터는 이동하지 않습니다.
- 통합 예약/결제 CRM, 세 서비스 전체 통합 기록 집계, 기존 NTAC 과제와 그룹 완료의 연결은 이번 배포에 포함되지 않습니다.

## 배포와 검증

Supabase CLI로 생성한 migration의 파일명은 운영에 적용된 버전 `20261020074200`과 일치시켰습니다.

DB migration을 먼저 적용한 다음 GitHub Pages 프런트엔드를 배포합니다. 기존 화면은 신규 테이블 없이도 그대로 동작하고 그룹 bootstrap 오류만 별도로 표시합니다. 프런트엔드를 이전 버전으로 되돌려도 새 그룹 기록을 삭제하지 않습니다.

검증: 독립 PostgreSQL에서 전체 참가 상태·추천 조건·권한·TV 공개 범위·중복/경합을 검사하고, 실제 운영 스키마에서도 롤백 전용 테스트를 수행합니다. Playwright는 가상 회원과 가로챈 API 응답만 사용하며 운영 DB에 쓰지 않습니다.

Supabase advisor의 새 `SECURITY DEFINER` 항목은 명시적으로 검토했습니다. 그룹 쓰기 RPC는 관리자/담당 코치/본인 검증 후에만 실행되며 테이블 직접 쓰기는 허용하지 않습니다. 익명 접근을 허용한 함수는 고엔트로피 연결 토큰을 검증하는 `group_display`뿐입니다. `private.group_display_tokens`는 일반 역할의 접근을 차단하고 정책 없는 RLS를 의도적으로 사용합니다. 기존 프로젝트의 다른 advisor 항목은 변경하지 않았습니다.

- [함수 실행 권한 점검 기준](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [익명 함수 실행 권한 점검 기준](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [정책 없는 RLS 점검 기준](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

## Weekly programs and strength upgrade (2026-10-20)

The group service remains independent of NTAC and PT. Official reservations and attendance stay in 운톡. No group action changes PT passes, sessions or NTAC workout records.

### Operating flow

1. In **그룹수업 → 주간 프로그램 → 반복 시간표 설정**, register recurring weekday/time/duration/coach slots. Slot IDs stay stable when editing.
2. Choose a week (Monday–Sunday, Asia/Seoul), add each training day, then **저장 · 멤버 공개 · 캘린더 반영**. Publication creates matching *future* class occurrences immediately. Members with group access can read both the published weekly overview and each scheduled class. Draft weeks remain staff-only.
3. Open a calendar class and **참가자 추가**. Published future classes create `planned` participants, never completed attendance. On the day, open registration and let the member or coach start the workout. Starting a planned entry refreshes its recommendation snapshot from the latest eligible history.
4. Members or coaches record actual sets, optionally actual set RIR, and finish with **수업 전체 RPE** (0–10). New classes require final session RPE to complete. Saving unfinished records does not require RPE. The coach can confirm the record; only completed, confirmed sets inform later recommendations.
5. Templates, individual class programs and weekly programs have deletion controls. Deletion archives rather than erases. Completed classes retain ended status and historical results. Removing a week cancels its future draft/published occurrences and planned rosters, preserving started/ended classes. Archived weeks can be replaced by a new program for the same dates.

Publishing again uses unique `(week_id, slot_id)` occurrences. It updates only unrostered, unstarted, nonarchived draft/published classes. Existing participants or started classes freeze the program, with a count of preserved classes returned to the UI. Deleted occurrences do not reappear when publishing again. Timetable changes affect subsequent publication; click **공개 · 시간표 반영** for a previously published week. There is no unbounded recurring cron, and past slots are never backfilled. A weekly overview can differ from a frozen occurrence; both views explain that the individual class is authoritative.

### Strength prescriptions and recommendation policy

An explicit `training_type: strength` movement stores 1–12 sets of `{reps, rir}`, load increment and minimum available load. For example `Back SQ 10–10–8–8–8, RIR 3`, total kg, 2.5 kg increment, 20 kg bar. Conditioning/other movements do not get automatic weights. Legacy movements and records retain their original single-result behavior.

The rule is a **starting-load estimate**, not a measured capacity, injury assessment or a guarantee that the target RIR will be achieved. The coach can override each set with a recorded reason. Recommendation snapshots carry rule version, source and date; the display endpoint strips private provenance and reasons.

For each set, in matching exercise/unit/load basis/difficulty:

- Look for completed and coach-confirmed, non-DNF group sets in the preceding 90 days. Prefer the corresponding set position in the most recent session. If actual RIR is known, estimate `e1RM = actual weight × (1 + (actual reps + actual RIR) / 30)` and invert for the new reps plus target RIR. Automatic increases are capped at 5% over that source set.
- A matching rep/target-RIR prescription without actual RIR may reuse the previous actual load; it is not used to infer an e1RM for a different prescription.
- Otherwise use the coach-registered measured/estimated 1RM (confirmed within 180 days), with `starting load = 1RM / (1 + (target reps + target RIR) / 30)`.
- Otherwise use an exact-condition coach baseline. With no usable basis, display **코치 확인**, never invent a load.
- Effective repetitions above 15 are outside this product rule's extrapolation range and require coach confirmation. Round weights **down** to the configured increment. Below-minimum, nonpositive and out-of-range loads require coach confirmation.
- A source session RPE of 9–10 reduces a history-based suggestion by 5% before rounding. Session RPE does not become a set RIR or change the recorded/measured 1RM. These 90/180-day windows, 15-rep boundary, 5% caps and session-RPE adjustment are conservative, configurable-in-code **product rules**, not validated physiological cutoffs.

A registered 100 kg 1RM with the above example gives **67.5 / 67.5 / 72.5 / 72.5 / 72.5 kg**. Actual input fields remain empty until the member explicitly confirms a set or types a result. Partial/missing sets never receive invented results. Strength leaderboard ranking uses total `weight × reps` only when every prescribed set's repetitions match, the participant completed the class, and the coach confirmed the record; difficulty groups remain separate. This ranks performance in the same prescription, not general fitness.

The set-RIR extension of Epley's formula is an implementation heuristic. Supporting primary reading: [Macarilla et al., 2022, prediction accuracy and Epley equation](https://pmc.ncbi.nlm.nih.gov/articles/PMC9465738/), [Lovegrove et al., RIR load prescription](https://pubmed.ncbi.nlm.nih.gov/36135029/), [Hughes et al., estimating RIR across exercises](https://pubmed.ncbi.nlm.nih.gov/33337690/). These sources do not validate this entire combined product algorithm.

1RM values are explicitly coach-entered in **회원 · 기준 중량 → 1RM 설정**. Existing NTAC/PT free-text records are not automatically reinterpreted as a group exercise, 1RM, unit or RIR. Group history is used once it has a standardized exercise, appropriate set data and coach confirmation.

### Security and verification

New tables have RLS and authenticated SELECT only; all mutations use guarded RPCs. Weekly/timetable publishing, archiving weeks and registering 1RM require admin privileges. Assigned coaches can manage only their classes/rosters. Members read only their own results and their eligible published programs. No anonymous table grants. TV remains token-scoped, read-only and opted-in; it receives set weights/reps/target RIR but never session RPE, source IDs or coach reasons.

Migration is additive and leaves previously stored recommendations/results untouched. Existing classes retain `recording_version=1` so their old completion flow remains compatible; classes created by the updated app or containing strength prescriptions use version 2 with final RPE. Cached legacy clients can still create version-1 classes during rollout. Optimistic revision checks reject stale/null revisions. Publication is serialized with timetable edits and class/participant operations.

Verification includes isolated PostgreSQL tests for publication idempotency, roster permission boundaries, frozen programs, archive/history, 1RM/history estimates, malformed sets, final RPE, TV sanitization and existing PT/NTAC isolation; browser tests cover weekly publishing/calendar, future roster, 1RM form, actual-only five-set inputs, RPE validation, save-error retention, removal and existing PT/NTAC flows. Hosted rollback-only smoke tests verify actual schema compatibility without keeping test records.

Post-upgrade advisors found no new missing group-table policies or missing group foreign-key indexes. Intentional guarded-definer warnings are reviewed above ([Supabase guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)); the anonymous display function remains token-gated and private display tokens intentionally have no direct-read policy.

Hosted migration versions: `20261020084237_group_weekly_strength.sql` and `20261020084533_group_recording_compatibility.sql`. Local filenames match hosted migration history.

## 7개 수업별 주간 묶음과 화면 개선 (2026-10-20)

새 주간 프로그램은 아래 일곱 수업을 한 묶음으로 저장합니다. 각 수업의 프로그램은 한 번 작성하고, 해당 주의 같은 종류 수업에 함께 적용합니다. 설명 또는 핵심 운동이 있는 수업만 공개되므로 일부 작성 후 공개하고 나머지를 이어서 작성할 수 있습니다. 기존 요일별 프로그램은 원래 형식으로 열리고 기록도 유지됩니다.

| 수업 | 요일 |
|---|---|
| GENTLE SWEAT | 화·수 |
| GENTLE STRENGTH | 월·금 |
| BOMB SWEAT | 월·금 |
| BOMB STRENGTH | 화·수 |
| YOU IN | 목 |
| NOLTO & TEAM | 토 |
| NO MORE WEAK | 일 |

첨부 시간표의 정규 수업 26개를 기본값으로 제공합니다. 목요일 YOU IN은 19:30, 토·일 수업은 10:00 시작입니다. 주말의 합쳐진 칸은 12:10 별도 수업으로 중복 생성하지 않습니다. OPEN GYM과 TRACK RUN은 이 묶음에서 제외합니다. 기본 수업 길이는 50분, NO MORE WEAK은 90분이며 실제 운영에 맞게 수정할 수 있습니다.

**관리 → 그룹수업 → 주간 프로그램**에서 주차 선택 → **이번 주 프로그램 만들기** → 수업별 작성 → **저장 · 멤버 공개 · 캘린더 반영** 순서로 사용합니다. 반복 시간표가 비어 있다면 첫 공개 시 기본 시간표를 저장하고 공개한 관리자를 담당 코치로 지정합니다. 다른 담당 코치/시간/길이가 필요하면 먼저 **반복 시간표 설정**에서 조정합니다. 기존 시간표는 자동으로 덮어쓰지 않으며, 예전 시간표에 수업 종류가 없다면 각 시간에 연결해야 합니다.

공개는 미래 수업만 생성합니다. 이미 참가자가 있거나 시작한 수업은 보존하며, 같은 코치의 같은 시작 시간에 기존 수업이 있으면 중복 생성하지 않고 건수를 알려줍니다. 시간표를 다시 불러와도 가능한 기존 슬롯 ID를 유지합니다. 슬롯 ID가 달라진 경우에도 참가자 없는 미래 수업만 교체하고 기존 참가 기록은 보존합니다. 지난 일정과 기존 NTAC/PT 기록은 변경하지 않습니다.

캘린더 열 수는 브라우저 전체가 아닌 실제 내용 영역의 너비에 따라 바뀝니다. 시간 표시는 한 줄로 유지하고 긴 수업명은 카드 안에서 줄바꿈합니다. 주간 편집창과 시간표는 작은 화면에서도 입력칸이 영역을 벗어나지 않도록 조정했습니다.

검증: 7개 수업/26개 시간표 정합성, 일부 공개, 반복 공개, 슬롯 교체, 권한, 이전 버전 호환, 참가 기록 보존은 독립 PostgreSQL 테스트로 확인합니다. 브라우저 테스트는 320·390·768·1024·1440·1920px에서 캘린더/편집창과 시간 한 줄 표시를 확인합니다. 실제 기기 테스트와 구분하며, 운영 DB 호환성은 롤백 전용 SQL로 확인합니다.

운영 적용 migration: `20261020091613_group_class_type_weeks.sql`. 운영 롤백 검사 통과 후 기존 수업 2개/참가 기록 1개의 내용 해시가 동일함을 확인했습니다. 보안 검사는 새 수업 종류 테이블의 RLS/읽기 권한, 쓰기 RPC의 관리자 검사, 비공개 보조 함수 실행 권한 차단을 확인했습니다.

## 회원 통합 관리와 비밀번호 변경 수정 (2026-10-20)

**관리 → 회원 통합 관리**는 서비스가 없는 신규 계정과 코치 계정까지 모두 표시합니다. 전체/PT/NTAC/그룹수업/미지정 필터와 이름·이메일·연락처 검색을 지원합니다. **이용 서비스 설정**에서 PT·NTAC·그룹수업을 독립적으로 선택합니다. PT·NTAC 담당 코치는 각각 지정하며, 그룹 코치는 수업에 지정합니다. PT·NTAC 목록의 ‘배정’도 동일한 설정을 사용합니다. 그룹수업 화면의 별도 이용 권한 토글은 통합 관리로 연결했습니다. 기준 중량·1RM·실제 수업 참가 등록은 그룹수업 화면에 유지합니다.

`set_member_services_v3`는 기존 배정 상태와 비교해 다른 기기의 변경을 감지하고, 세 서비스의 변경을 한 트랜잭션으로 저장합니다. 기존 역할 검증과 RLS를 유지하는 SECURITY INVOKER 함수입니다. 이용 서비스를 중지해도 그룹 기록·PT 일지·횟수권은 삭제하지 않습니다. 이용 서비스와 관리자 역할은 별개이며, 서비스 배정으로 관리자 권한을 얻을 수 없습니다. 이전 v2 API는 캐시된 화면 호환을 위해 유지합니다.

비밀번호 변경 실패 원인: `profiles`에 SELECT 권한이 없는 `service_role` 클라이언트로 관리자 역할을 조회하고, 그 조회 오류를 403 ‘관리자 권한 필요’로 반환했습니다. 수정된 `ntac-admin-password` v2는 검증한 호출자 토큰의 authenticated/RLS 문맥에서 본인 역할과 대상 회원을 읽습니다. 별도 서버 전용 클라이언트는 Auth Admin의 비밀번호 변경에만 사용합니다. 서버 키의 테이블 권한을 확대하지 않았습니다. 조회 장애는 503, 잘못된 로그인은 401, 실제 권한 부족은 403으로 구분합니다. 일반 회원과 일반 코치는 다른 계정의 비밀번호를 변경할 수 없으며, 보호된 직원 계정 정책은 유지합니다.

검증: 운영 DB에서 owner/admin의 실제 RLS 조회, 8가지 서비스 조합, 개별 코치 배정, 오래된 상태 저장 차단, 기존 기록/횟수권 보존을 롤백 테스트했습니다. 비밀번호 핸들러 테스트는 실제 운영의 ‘service_role SELECT 불가’ 조건을 재현하며 owner/admin 허용 및 회원/코치/무효 세션 거부를 확인합니다. 브라우저 테스트는 미지정 회원 표시, 서비스 배정·필터 반영, 변경 실패 시 입력 보존, 비밀번호 성공/조회 오류 표시와 320–1440px 편집 화면을 검사합니다. 실제 회원 비밀번호를 테스트용으로 변경하지 않습니다.

운영 migration: `20261020134027_unified_member_services.sql`. 요청한 ‘테스트’ 계정은 기존 PT/그룹 상태와 담당 코치를 유지한 채 NTAC 이용을 활성화했습니다.


## 회원 캘린더와 주간 프로그램 (2026-10-21)

회원 **그룹수업 → 수업 캘린더**는 월간 달력을 기본으로 열고 주간 보기로 전환할 수 있습니다. 월요일부터 일요일까지 7열을 유지하며, 휴대폰에서는 날짜·수업 수, 넓은 화면에서는 시간·수업명 일부를 표시합니다. 날짜를 누르면 그날의 수업만 펼쳐지고 기존 운동 시작·추천·기록·RPE 흐름으로 연결됩니다. 월 경계에 걸친 앞뒤 주까지 서울 시간 기준으로 조회합니다. 관리자 수업 조회의 기본 주간 범위는 유지합니다.

**주간 프로그램** 탭에는 공개된 묶음을 요일별로 표시합니다. 수업 발생 여부와 독립적으로 주간 원본을 읽으므로 주중 공개로 지난 요일의 수업이 생성되지 않아도 프로그램은 볼 수 있습니다. 프로그램을 누르면 설명·종목·반복·RIR을 상세 창에서 확인하고 **이 날짜 수업 보기**로 이동합니다. 미작성/미공개 내용은 공개 전으로 표시하며 기존 요일별 형식도 지원합니다.

회원 화면의 날짜 입력칸을 월/주 이동 버튼으로 대체했습니다. 관리자 날짜 입력은 작은 화면에서 독립된 줄을 사용하고 iOS 네이티브 입력의 최소 너비를 제한합니다. 탭·수업 카드·기록 필드·추천 영역의 간격과 줄바꿈을 조정했습니다.

검증: 날짜 범위/윤년/연도 이동, 일곱 수업의 요일 매핑, 수업 발생 없는 프로그램 표시, 월/주 전환, 날짜 선택, 320–1920px 캘린더·주간표·버튼 충돌, 프로그램 상세→수업→기록 저장을 Chromium에서 확인했습니다. PT/NTAC 및 회원 통합 관리 회귀 테스트도 통과했습니다. 실물 iPhone Safari 검증은 수행하지 못했습니다. WebKit 실행에 필요한 시스템 라이브러리를 현재 환경에 설치할 수 없어 해당 엔진 검증은 제외했습니다.

## 지난주까지 공개·운동 DB·관리자 캘린더 (2026-10-21)

멤버가 열람할 수 있는 가장 오래된 프로그램은 **서울 시간 기준 이번 주 월요일에서 7일 전**에 시작하는 주입니다. 예를 들어 2026-10-21에는 10월 12일 00:00 이후 수업과 10월 12일 시작 주간 묶음부터 볼 수 있습니다. 미래에 공개한 프로그램은 그대로 볼 수 있습니다. 매주 월요일 기준이 자동으로 이동하며 데이터는 삭제하거나 일괄 비공개 처리하지 않습니다.

`private.group_access`와 `group_weeks_read`가 조회 범위를 제한하므로 테이블 조회 및 직접 수업 링크/RPC에도 동일한 규칙이 적용됩니다. 본인이 참여했던 수업이어도 오래된 프로그램 본문을 다시 조회할 수 없습니다. 관리자 및 담당 코치는 과거 수업에 대한 기존 관리 권한을 유지하며 주간 묶음의 직원 권한도 유지합니다. 오래된 수업에 연결된 TV도 프로그램을 반환하지 않습니다.

개인 기록은 새 `group_my_history`를 통해 계속 확인합니다. 외부 함수는 SECURITY INVOKER이며 비공개 함수가 로그인한 본인의 기록만 반환합니다. 결과·실제 RPE·수업명/일자·기록한 종목 식별정보만 제공하고 프로그램 설명, 처방 세트, 추천 중량은 이 응답에 포함하지 않습니다. 이전 기록은 읽기 전용 창에서 열립니다. 운동 횟수 통계와 그룹 이용이 중지된 회원의 기록도 유지합니다.

**관리 → 그룹수업 → 운동 DB**에서 전체 기간/조회 월/프로그램 이름으로 주간 묶음과 개별 수업을 찾습니다. 삭제·보관된 자료도 조회하고, 주간 묶음은 수업별 내용을 선택한 뒤 해당 주 관리 화면으로 이동합니다. 개별 수업은 기존 참가자·기록 관리 화면으로 연결됩니다. 조회는 최신순 20개씩이며 공개 기간이 지난 자료에는 ‘멤버 공개 종료’를 표시합니다. 과거 보관본을 저장해도 공개 기간은 늘어나지 않습니다.

관리자 **수업 운영**은 회원과 같은 월간/주간 캘린더를 사용합니다. 날짜 선택 시 해당 날짜의 수업만 펼치고, 선택한 날짜로 바로 수업을 만들 수 있습니다. 관리자는 과거 날짜로 제한 없이 이동합니다. 모호했던 대각선 화살표는 ‘상세 보기’, ‘기록 보기’, ‘수업 관리’로 교체했습니다.

검증: 격리 PostgreSQL에서 59개 검증과 권한 거부 테스트, 운영 DB에서 지난주 월요일 경계/과거 직접 조회 거부/개인 기록 보존/관리자 과거 조회를 롤백 검증했습니다. 회원·관리자 브라우저의 320–1920px 캘린더와 운동 DB 검색/분류 전환/기록 흐름, 기존 NTAC/PT 회귀 테스트를 실행했습니다. 운영 보안 점검에서 이번 변경으로 추가된 항목은 없습니다. 기존 TV용 익명 SECURITY DEFINER 경고는 만료·취소 가능한 표시 전용 토큰으로 의도적으로 제한됩니다([Supabase 점검 기준](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)). 실물 iPhone 검증은 포함하지 않습니다.

운영 migration: `20261021021051_group_program_visibility.sql`.
# NOLTO 2.0 training journey — 2026-10-21

The member group home shows a separate compact training-journey section. Its clock uses Asia/Seoul and refreshes on focus and every minute. This is the shared program's position, not a count of the member's attendance. The current phase, week and class-specific goal are visible first; the full roadmap and phase explanations expand on demand.

- 2026-10-21–11-01: season preparation; do not pretend that a training block has already started.
- 2026-11-02–12-27: 8-week PRE-SEASON, using the regular cycle's weeks 5–12 (LOAD, RESET, PERFORM, SHOWTIME). Member numbering is 1–8. SWEAT assessment is 12/14–20 and STRENGTH assessment is 12/21–27.
- 2026-12-28–2027-01-03: preparation for the regular season.
- 2027 BLOCK 01: 01/04–03/28. Transition: 03/29–04/04.
- 2027 BLOCK 02: 04/05–06/27. Transition: 06/28–07/04.
- 2027 BLOCK 03: weeks 1–10 on 07/05–09/12; Chuseok adjustment on 09/13–19; weeks 11–12 on 09/20–10/03. The adjustment week never advances the training count.
- 2027 BLOCK 04: 10/04–12/26. Transition: 12/27–2028-01-02.
- Dates outside the agreed schedule do not invent new blocks or repeat a previous year's goals.

Regular phases are READY 1, BUILD 2–4, LOAD 5–6, RESET 7, PERFORM 8–10 and SHOWTIME 11–12. The last two weeks separate SWEAT and STRENGTH assessment. The non-assessed class description explicitly calls for adjusted training demand.

Quarter focus alternates Gentle Strength upper/lower/upper/lower and Bomb Strength lower/upper/lower/upper. Sweat goals stay class-specific and are not assigned strength body-part targets. Preseason body-part focus and exact assessment exercises are intentionally not treated as decided. Gentle's agreed assessment family is 3RM/5RM, Bomb's is 1RM/2RM; the app asks members to wait for the actual selected exercise and rep target.

Calendar phase bands, selected-day context, weekly program dialogs and both program editors use the scheduled date. This does not add exercise restrictions, approval gates or changes to program publication/visibility, attendance, recommendations, PT balances, NTAC plans or stored records. Calendar week bands use the end of the Monday–Sunday week so the partial launch week includes the rollout on Wednesday.

The shared schedule and descriptions live in `web/src/groups/trainingCycle.js`. Update this single source after future planning decisions; this release adds no database schema or member data changes. `TrainingJourney.jsx` renders the member overview and shared `TrainingContext`. `node tests/training-cycle.mjs` checks calendar boundaries, all planned training dates, Korea midnight, holiday pauses and class-specific goals.
