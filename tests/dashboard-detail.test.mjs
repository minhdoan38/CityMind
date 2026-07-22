import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');

function read(rel) {
  return fs.readFileSync(path.resolve(root, rel), 'utf8');
}

test('detail page follows D-19 section order with advisory AI and actor timeline', () => {
  const pagePath = 'src/app/dashboard/reports/[reportId]/page.tsx';
  assert.ok(fs.existsSync(path.resolve(root, pagePath)), 'detail page must exist');
  const src = read(pagePath);

  // Advisory labeling (D-20)
  assert.ok(
    /AI analysis \(advisory\)|detailAiTitle|advisory/i.test(src),
    'detail must label AI analysis as advisory',
  );
  assert.ok(
    /AI-generated analysis is advisory|detailAiDisclaimer/i.test(src),
    'detail must include advisory disclaimer',
  );

  // Actor-aware timeline (D-21)
  assert.ok(
    /actor_id|Officer|detailActor/.test(src),
    'timeline must reference actor_id or Officer label',
  );

  // StatusActions after timeline (D-19)
  const timelineIdx = Math.max(
    src.indexOf('Status history'),
    src.indexOf('detailTimeline'),
    src.indexOf('status-history'),
  );
  const actionsIdx = Math.max(
    src.lastIndexOf('<StatusActions'),
    src.lastIndexOf('detailActions'),
    src.lastIndexOf('Officer decision'),
  );
  assert.ok(timelineIdx >= 0, 'detail must include status timeline section');
  assert.ok(actionsIdx >= 0, 'detail must render StatusActions');
  assert.ok(
    actionsIdx > timelineIdx,
    'StatusActions must appear after status timeline in JSX (D-19)',
  );

  // Section heading markers in D-19 order
  const markers = [
    /Citizen report|detailCitizen/,
    /Evidence|detailEvidence/,
    /AI analysis \(advisory\)|detailAiTitle/,
    /Urban context|detailUrban/,
    /Status history|detailTimeline/,
    /Officer decision|detailActions|<StatusActions/,
  ];
  let last = -1;
  for (const re of markers) {
    const m = src.match(re);
    assert.ok(m, `missing section marker: ${re}`);
    const idx = m.index;
    assert.ok(idx > last, `section order violation near ${re}`);
    last = idx;
  }

  // Preserve Phase 4 CopyStatusLink
  assert.ok(src.includes('CopyStatusLink'), 'must preserve CopyStatusLink');
});

test('EN/VI catalogs include detail section and empty/error copy', () => {
  const en = JSON.parse(read('messages/en.json'));
  const vi = JSON.parse(read('messages/vi.json'));
  const d = en.dashboard;
  const v = vi.dashboard;

  assert.equal(d.detailAiTitle, 'AI analysis (advisory)');
  assert.equal(v.detailAiTitle, 'Phân tích AI (tham khảo)');
  assert.ok(d.detailAiDisclaimer?.includes('advisory'));
  assert.ok(v.detailAiDisclaimer?.includes('tham khảo'));
  assert.equal(d.detailCitizen, 'Citizen report');
  assert.equal(v.detailCitizen, 'Báo cáo của người dân');
  assert.equal(d.detailEvidence, 'Evidence');
  assert.equal(v.detailEvidence, 'Bằng chứng');
  assert.equal(d.detailUrban, 'Urban context');
  assert.equal(v.detailUrban, 'Bối cảnh đô thị');
  assert.equal(d.detailTimeline, 'Status history');
  assert.equal(v.detailTimeline, 'Lịch sử trạng thái');
  assert.equal(d.detailTimelineEmpty, 'No status changes yet.');
  assert.equal(v.detailTimelineEmpty, 'Chưa có thay đổi trạng thái.');
  assert.equal(d.detailActions, 'Officer decision');
  assert.equal(v.detailActions, 'Quyết định của cán bộ');
  assert.equal(d.detailNotFound, 'Report not found');
  assert.equal(v.detailNotFound, 'Không tìm thấy báo cáo');
  assert.equal(d.detailActor, 'Officer');
  assert.equal(v.detailActor, 'Cán bộ');
  assert.equal(d.detailBack, 'Back to reports');
  assert.equal(v.detailBack, 'Quay lại danh sách báo cáo');
});

test('StatusActions uses Dialog note gate for resolve/reject', () => {
  assert.ok(
    fs.existsSync(path.resolve(root, 'src/components/ui/dialog.tsx')),
    'shadcn dialog.tsx must exist',
  );
  const src = read('src/components/StatusActions.tsx');
  assert.ok(
    /from ["']@\/components\/ui\/dialog["']/.test(src),
    'StatusActions must import Dialog components',
  );
  assert.ok(
    /searchParams\.set\(["']note["']/.test(src),
    'resolved/rejected path must set note on the PATCH URL',
  );
  assert.ok(
    /reviewing/.test(src) && /Dialog|pendingStatus|openDialog|setDialog/.test(src),
    'StatusActions must distinguish reviewing from dialog-gated statuses',
  );
  // reviewing must be callable without requiring dialog open first
  assert.ok(
    /updateStatus\(\s*["']reviewing["']|status === ["']reviewing["']|status !== ["']reviewing["']|status === "reviewing"|=== 'reviewing'/.test(
      src,
    ) ||
      (/reviewing/.test(src) &&
        /immediate|without.?dialog|no.?dialog|!.*dialog|openConfirm|setPending/i.test(src)),
    'reviewing path must not require Dialog open for PATCH',
  );
  assert.ok(
    /trim\(\)/.test(src),
    'note must be trimmed before send',
  );
  assert.ok(
    !/actor_id|actorId|actor=/.test(src) || !/searchParams\.set\(["']actor/.test(src),
    'actor must never be collected in StatusActions UI',
  );
});

test('EN/VI catalogs include Confirm resolve / reject Dialog copy', () => {
  const en = JSON.parse(read('messages/en.json'));
  const vi = JSON.parse(read('messages/vi.json'));
  assert.equal(en.dashboard.confirmResolve, 'Confirm resolve');
  assert.equal(vi.dashboard.confirmResolve, 'Xác nhận đã xử lý');
  assert.equal(en.dashboard.confirmReject, 'Confirm reject');
  assert.equal(vi.dashboard.confirmReject, 'Xác nhận từ chối');
  assert.equal(en.dashboard.dialogDismiss, 'Keep editing');
  assert.equal(vi.dashboard.dialogDismiss, 'Giữ nguyên');
  assert.equal(en.dashboard.noteRequired, 'A note is required to resolve or reject.');
  assert.equal(vi.dashboard.noteRequired, 'Cần ghi chú để xác nhận đã xử lý hoặc từ chối.');
  assert.equal(en.dashboard.markReviewing, 'Mark as reviewing');
  assert.equal(vi.dashboard.markReviewing, 'Đánh dấu đang xem xét');
  assert.equal(en.dashboard.markResolved, 'Mark as resolved');
  assert.equal(vi.dashboard.markResolved, 'Đánh dấu đã xử lý');
  assert.equal(en.dashboard.markRejected, 'Mark as rejected');
  assert.equal(vi.dashboard.markRejected, 'Đánh dấu từ chối');
});
