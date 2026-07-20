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
