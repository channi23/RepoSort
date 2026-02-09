#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const TRACE_ID = 'gemini-hero-e2e-1';
const PROJECT_ID = 'bfa36404-aefb-4dcb-be2b-85ad8673695f';

const headers = {
  'content-type': 'application/json',
  'x-trace-id': TRACE_ID,
  'x-role': 'developer',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

async function requestWithRetry(method, url, body, options = {}) {
  const retries = options.retries ?? 3;
  const backoffs = [1000, 2000, 4000];
  let lastErr;

  for (let i = 0; i <= retries; i += 1) {
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      let json;
      const text = await res.text();
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }

      if (!res.ok && isRetryableStatus(res.status) && i < retries) {
        console.log(`retryable ${method} ${url} -> status=${res.status}, retry=${i + 1}`);
        await sleep(backoffs[i] ?? backoffs[backoffs.length - 1]);
        continue;
      }

      return { status: res.status, ok: res.ok, data: json };
    } catch (err) {
      lastErr = err;
      if (i < retries) {
        console.log(`retryable ${method} ${url} -> network error, retry=${i + 1}`);
        await sleep(backoffs[i] ?? backoffs[backoffs.length - 1]);
        continue;
      }
    }
  }

  throw lastErr || new Error(`request failed: ${method} ${url}`);
}

function printReq(label, method, url) {
  console.log(`\n[${label}] ${method} ${url}`);
}

async function waitForNodeAction(nodeActionId, timeoutMs = 120000) {
  const started = Date.now();
  const url = `${BASE_URL}/node-actions/${nodeActionId}`;

  while (Date.now() - started < timeoutMs) {
    const res = await requestWithRetry('GET', url, null, { retries: 2 });
    if (!res.ok) throw new Error(`poll node-action failed status=${res.status} data=${JSON.stringify(res.data)}`);

    const a = res.data;
    const status = a?.status;
    const runId = a?.runId || null;

    console.log(`poll nodeAction status=${status} runId=${runId ?? 'n/a'}`);
    if (a?.executionSources) {
      console.log(`nodeAction.executionSources=${JSON.stringify(a.executionSources)}`);
    }

    if (status === 'SUCCEEDED' || status === 'FAILED') return a;
    await sleep(1500);
  }

  throw new Error('nodeAction polling timeout');
}

async function getLatestGraphAndNodes() {
  const url = `${BASE_URL}/projects/${PROJECT_ID}/graph?ref=latest`;
  printReq('graph-latest', 'GET', url);
  const res = await requestWithRetry('GET', url, null, { retries: 2 });
  if (!res.ok) throw new Error(`get latest graph failed status=${res.status} data=${JSON.stringify(res.data)}`);

  const graphSnapshotId = res.data?.graphSnapshotId;
  const nodes = Array.isArray(res.data?.nodes) ? res.data.nodes : [];
  if (!graphSnapshotId || nodes.length < 2) {
    throw new Error(`insufficient nodes in latest graph graphSnapshotId=${graphSnapshotId} nodeCount=${nodes.length}`);
  }

  const node1 = nodes[0]?.id;
  const node2 = nodes[1]?.id;
  if (!node1 || !node2) throw new Error('could not extract two node IDs');

  console.log(`graphSnapshotId=${graphSnapshotId}`);
  console.log(`selectedNodeIds=[${node1}, ${node2}]`);

  return { graphSnapshotId, node1, node2 };
}

async function createNodeAction(graphSnapshotId, nodeIds) {
  const url = `${BASE_URL}/node-actions/refactor`;
  const payload = {
    projectId: PROJECT_ID,
    graphSnapshotId,
    selectedNodeIds: nodeIds,
    prompt: 'Refactor and add validation and tests',
  };

  printReq('node-action-refactor', 'POST', url);
  console.log(`payload=${JSON.stringify({ ...payload, selectedNodeIds: ['<id1>', '<id2>'] })}`);

  const res = await requestWithRetry('POST', url, payload, { retries: 3 });
  if (!res.ok) {
    return { ok: false, status: res.status, data: res.data };
  }
  return { ok: true, status: res.status, data: res.data };
}

async function main() {
  console.log('=== Gemini Hero E2E Smoke Test ===');
  console.log(`BASE_URL=${BASE_URL}`);
  console.log(`projectId=${PROJECT_ID}`);
  console.log(`x-trace-id=${TRACE_ID}`);

  const urlsUsed = [];
  let graphSnapshotId;
  let nodeActionId;
  let runId;

  try {
    const ingestUrl = `${BASE_URL}/projects/${PROJECT_ID}/ingest`;
    urlsUsed.push(ingestUrl);
    printReq('ingest', 'POST', ingestUrl);
    const ingest = await requestWithRetry('POST', ingestUrl, {}, { retries: 3 });
    if (!ingest.ok) throw new Error(`ingest failed status=${ingest.status} data=${JSON.stringify(ingest.data)}`);
    console.log(`queued=${ingest.data?.queued} jobId=${ingest.data?.jobId}`);
    await sleep(3500);

    const buildUrl = `${BASE_URL}/projects/${PROJECT_ID}/graph/build`;
    urlsUsed.push(buildUrl);
    printReq('graph-build', 'POST', buildUrl);
    const build = await requestWithRetry('POST', buildUrl, {}, { retries: 3 });
    if (!build.ok) throw new Error(`graph build failed status=${build.status} data=${JSON.stringify(build.data)}`);
    console.log(`queued=${build.data?.queued} jobId=${build.data?.jobId}`);
    await sleep(3500);

    const analyzeUrl = `${BASE_URL}/projects/${PROJECT_ID}/analyze`;
    urlsUsed.push(analyzeUrl);
    printReq('analyze', 'POST', analyzeUrl);
    const analyze = await requestWithRetry('POST', analyzeUrl, {}, { retries: 3 });
    if (!analyze.ok) throw new Error(`analyze failed status=${analyze.status} data=${JSON.stringify(analyze.data)}`);
    console.log(`queued=${analyze.data?.queued} jobId=${analyze.data?.jobId}`);
    await sleep(3500);

    const latest = await getLatestGraphAndNodes();
    graphSnapshotId = latest.graphSnapshotId;

    let nodeActionRes = await createNodeAction(graphSnapshotId, [latest.node1, latest.node2]);

    if (!nodeActionRes.ok) {
      const msg = JSON.stringify(nodeActionRes.data || {});
      const retryableSelectedNodesIssue = /selectedNodeIds|outside the graph snapshot|GraphSnapshot/i.test(msg);
      if (retryableSelectedNodesIssue) {
        console.log('nodeAction failed due to snapshot/node mismatch, refetching latest graph and retrying once...');
        const latest2 = await getLatestGraphAndNodes();
        graphSnapshotId = latest2.graphSnapshotId;
        nodeActionRes = await createNodeAction(graphSnapshotId, [latest2.node1, latest2.node2]);
      }
    }

    if (!nodeActionRes.ok) {
      throw new Error(`node-action create failed status=${nodeActionRes.status} data=${JSON.stringify(nodeActionRes.data)}`);
    }

    nodeActionId = nodeActionRes.data?.nodeActionId;
    if (!nodeActionId) throw new Error(`nodeActionId missing in response: ${JSON.stringify(nodeActionRes.data)}`);
    console.log(`nodeActionId=${nodeActionId}`);

    const action = await waitForNodeAction(nodeActionId, 120000);
    runId = action?.runId || null;
    if (!runId) throw new Error(`runId missing on nodeAction=${nodeActionId}`);

    const runUrl = `${BASE_URL}/runs/${runId}`;
    urlsUsed.push(runUrl);
    printReq('run-get', 'GET', runUrl);
    const runRes = await requestWithRetry('GET', runUrl, null, { retries: 2 });
    if (!runRes.ok) throw new Error(`get run failed status=${runRes.status} data=${JSON.stringify(runRes.data)}`);
    if (runRes.data?.executionSources) {
      console.log(`run.executionSources=${JSON.stringify(runRes.data.executionSources)}`);
    }

    const verUrl = `${BASE_URL}/runs/${runId}/verification`;
    urlsUsed.push(verUrl);
    printReq('verification-get', 'GET', verUrl);
    const verRes = await requestWithRetry('GET', verUrl, null, { retries: 2 });
    if (!verRes.ok) throw new Error(`verification failed status=${verRes.status} data=${JSON.stringify(verRes.data)}`);

    const diffUrl = `${BASE_URL}/runs/${runId}/diff`;
    urlsUsed.push(diffUrl);
    printReq('diff-get', 'GET', diffUrl);
    const diffRes = await requestWithRetry('GET', diffUrl, null, { retries: 2 });
    if (!diffRes.ok) throw new Error(`diff failed status=${diffRes.status} data=${JSON.stringify(diffRes.data)}`);

    const patchUrl = `${BASE_URL}/runs/${runId}/patch`;
    urlsUsed.push(patchUrl);
    printReq('patch-get', 'GET', patchUrl);
    const patchRes = await requestWithRetry('GET', patchUrl, null, { retries: 2 });
    if (!patchRes.ok) throw new Error(`patch failed status=${patchRes.status} data=${JSON.stringify(patchRes.data)}`);

    const runStatus = runRes.data?.status;
    const verification = verRes.data?.verification ?? verRes.data;
    const diff = diffRes.data?.diff ?? diffRes.data;
    const patchBytes = patchRes.data?.bytes;

    console.log('\n--- Summary ---');
    console.log(`run.status=${runStatus}`);
    console.log(`verification.confidence=${verification?.confidence ?? 'n/a'} residualRiskCount=${verification?.residualRiskCount ?? 'n/a'}`);
    console.log(`diff.riskDelta=${diff?.riskDelta ?? 'n/a'}`);
    console.log(`patch.bytes=${patchBytes ?? 'n/a'}`);

    console.log('\n--- IDs ---');
    console.log(`graphSnapshotId=${graphSnapshotId}`);
    console.log(`nodeActionId=${nodeActionId}`);
    console.log(`runId=${runId}`);

    console.log('\n--- URLs Used ---');
    for (const u of urlsUsed) console.log(u);

    if (String(runStatus) === 'SUCCEEDED' && verification && diff && typeof patchBytes !== 'undefined') {
      console.log('\n✅ PASS');
      process.exit(0);
    }

    console.log(`\n❌ FAIL runStatus=${runStatus} verification=${Boolean(verification)} diff=${Boolean(diff)} patchBytes=${patchBytes}`);
    process.exit(1);
  } catch (err) {
    console.error('\n❌ FAIL', err?.message || err);
    if (graphSnapshotId || nodeActionId || runId) {
      console.error(`Captured IDs: graphSnapshotId=${graphSnapshotId || 'n/a'} nodeActionId=${nodeActionId || 'n/a'} runId=${runId || 'n/a'}`);
    }
    process.exit(1);
  }
}

main();
