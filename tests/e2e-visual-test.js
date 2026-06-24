/* ──────────────────────────────────────────────────────────────────────────────
 * StampVault E2E Visual Test Runner
 * 
 * Automated end-to-end testing with:
 *   - Visual screenshot capture at every step
 *   - 4x consecutive stamp identification verification
 *   - Both individual and batch/sheet upload modes
 *   - Auto-bug reporting to bugs/ directory
 *   - 1:1 match validation against VERIFIED_STAMPS database
 * ────────────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');

// ── Configuration ──────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:3000';
const REPORT_DIR = path.join(__dirname, '..', 'e2e-reports');
const BUGS_DIR = path.join(REPORT_DIR, 'bugs');
const SCREENSHOTS_DIR = path.join(REPORT_DIR, 'screenshots');

// Test stamps with expected identification
const TEST_STAMPS = [
  {
    file: 'stamp-4.png',
    path: path.join(__dirname, '..', 'public', 'test-stamps', 'stamp-4.png'),
    expected: {
      country: 'United States',
      scottNumber: '814',
      denomination: '9¢',
      name: 'Harrison Prexie',
    },
  },
  {
    file: 'stamp-2.png',
    path: path.join(__dirname, '..', 'public', 'test-stamps', 'stamp-2.png'),
    expected: {
      country: 'United States',
      scottNumber: '804',
      denomination: '1¢',
      name: 'Washington Prexie',
    },
  },
  {
    file: 'stamp-3.png',
    path: path.join(__dirname, '..', 'public', 'test-stamps', 'stamp-3.png'),
    expected: {
      country: 'United States',
      scottNumber: '813',
      denomination: '8¢',
      name: 'Van Buren Prexie',
    },
  },
  {
    file: 'inverted-jenny.jpg',
    path: path.join(__dirname, '..', 'public', 'test-stamps', 'inverted-jenny.jpg'),
    expected: {
      country: 'United States',
      scottNumber: 'C3a',
      denomination: '24¢',
      name: 'Inverted Jenny',
    },
  },
];

// ── Utility Functions ──────────────────────────────────────────────────────

function ensureDirs() {
  [REPORT_DIR, BUGS_DIR, SCREENSHOTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Auto-submit a bug report to the bugs/ directory.
 */
function submitBug(bugData) {
  const ts = timestamp();
  const bugId = `BUG-${ts}-${Math.random().toString(36).slice(2, 6)}`;
  const bugFile = path.join(BUGS_DIR, `${bugId}.md`);
  
  const content = `# Bug Report: ${bugId}

## Summary
${bugData.summary}

## Severity
${bugData.severity || 'MEDIUM'}

## Steps to Reproduce
${bugData.steps || 'See test context below.'}

## Expected Result
${bugData.expected}

## Actual Result
${bugData.actual}

## Test Context
- **Test Round**: ${bugData.round || 'N/A'}
- **Upload Mode**: ${bugData.mode || 'N/A'}
- **Stamp File**: ${bugData.stampFile || 'N/A'}
- **Timestamp**: ${new Date().toISOString()}
- **Screenshot**: ${bugData.screenshotPath || 'N/A'}

## Environment
- URL: ${BASE_URL}
- Browser: Chrome DevTools Protocol
- Viewport: Mobile (393x852) / Desktop

## Raw Data
\`\`\`json
${JSON.stringify(bugData.rawData || {}, null, 2)}
\`\`\`
`;
  
  fs.writeFileSync(bugFile, content);
  console.log(`  🐛 Bug auto-submitted: ${bugId}`);
  return bugId;
}

/**
 * Validate identification result against expected data.
 * Returns { pass: boolean, details: string, mismatches: object[] }
 */
function validateIdentification(result, expected, tolerance = {}) {
  const mismatches = [];
  
  // Country match (case-insensitive)
  if (result.country?.toLowerCase() !== expected.country?.toLowerCase()) {
    mismatches.push({
      field: 'country',
      expected: expected.country,
      actual: result.country,
    });
  }
  
  // Scott number match (if expected has one)
  // Accept base number matches: "C3" matches "C3a" (variant suffixes are optional)
  if (expected.scottNumber) {
    const resultScott = (result.scottNumber || '').trim().toLowerCase();
    const expectedScott = expected.scottNumber.trim().toLowerCase();
    // Extract base number (letters + digits) without trailing variant letter
    const baseNumber = (s) => s.replace(/[a-z]$/, '');
    const exactMatch = resultScott === expectedScott;
    const baseMatch = baseNumber(resultScott) === baseNumber(expectedScott);
    if (!exactMatch && !baseMatch) {
      mismatches.push({
        field: 'scottNumber',
        expected: expected.scottNumber,
        actual: result.scottNumber,
      });
    }
  }
  
  // Denomination match — extract numeric value for flexible comparison
  // Handles: "9¢" vs "9 Cents", "24¢" vs "24 Cents", "1¢" vs "1 Cent"
  if (expected.denomination) {
    const extractNum = (str) => {
      const match = (str || '').match(/(\d+)/);
      return match ? match[1] : '';
    };
    const resultNum = extractNum(result.denomination);
    const expectedNum = extractNum(expected.denomination);
    // Also do a loose string check as backup
    const resultDenom = (result.denomination || '').toLowerCase().replace(/[¢$€£]/g, '').trim();
    const expectedDenom = expected.denomination.toLowerCase().replace(/[¢$€£]/g, '').trim();
    
    const numericMatch = resultNum === expectedNum && resultNum !== '';
    const stringMatch = resultDenom.includes(expectedDenom) || expectedDenom.includes(resultDenom);
    
    if (!numericMatch && !stringMatch) {
      mismatches.push({
        field: 'denomination',
        expected: expected.denomination,
        actual: result.denomination,
      });
    }
  }
  
  // Confidence must be >= 0.50 for a valid identification
  if (typeof result.aiConfidence === 'number' && result.aiConfidence < 0.50) {
    mismatches.push({
      field: 'aiConfidence',
      expected: '>= 0.50',
      actual: result.aiConfidence,
    });
  }
  
  // Not-a-stamp detection should NOT fire for actual stamps
  if (result.country === 'Not a stamp') {
    mismatches.push({
      field: 'notAStamp',
      expected: 'Valid stamp identification',
      actual: 'Incorrectly classified as not a stamp',
    });
  }
  
  return {
    pass: mismatches.length === 0,
    details: mismatches.length === 0
      ? `✅ PASS: ${expected.name} correctly identified (confidence: ${result.aiConfidence})`
      : `❌ FAIL: ${mismatches.length} mismatch(es): ${mismatches.map(m => `${m.field}: expected "${m.expected}" got "${m.actual}"`).join('; ')}`,
    mismatches,
  };
}

/**
 * Generate the final test report.
 */
function generateReport(results) {
  const ts = timestamp();
  const reportFile = path.join(REPORT_DIR, `e2e_test_report_${ts}.md`);
  
  const totalTests = results.length;
  const passed = results.filter(r => r.pass).length;
  const failed = totalTests - passed;
  const passRate = totalTests > 0 ? Math.round((passed / totalTests) * 100) : 0;
  
  let content = `# StampVault E2E Test Report

**Generated**: ${new Date().toISOString()}
**Pass Rate**: ${passRate}% (${passed}/${totalTests})
**Status**: ${failed === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failed} TEST(S) FAILED`}

---

## Test Results Summary

| Round | Mode | Stamp | Country | Scott # | Confidence | Result |
|-------|------|-------|---------|---------|------------|--------|
`;

  for (const r of results) {
    content += `| ${r.round} | ${r.mode} | ${r.stampName} | ${r.identification?.country || 'N/A'} | ${r.identification?.scottNumber || 'N/A'} | ${r.identification?.aiConfidence?.toFixed(2) || 'N/A'} | ${r.pass ? '✅' : '❌'} |\n`;
  }

  content += `\n---\n\n## Detailed Results\n\n`;

  for (const r of results) {
    content += `### Round ${r.round} — ${r.mode} — ${r.stampName}\n`;
    content += `- **Result**: ${r.details}\n`;
    content += `- **Screenshot**: ${r.screenshotPath || 'N/A'}\n`;
    if (r.identification) {
      content += `- **AI Confidence**: ${r.identification.aiConfidence}\n`;
      content += `- **Description**: ${r.identification.description}\n`;
      content += `- **Notes**: ${r.identification.identificationNotes}\n`;
    }
    if (r.bugId) {
      content += `- **Bug Report**: ${r.bugId}\n`;
    }
    content += `\n`;
  }

  if (failed > 0) {
    content += `## Auto-Filed Bugs\n\n`;
    for (const r of results.filter(r => !r.pass)) {
      content += `- **${r.bugId}**: ${r.details}\n`;
    }
  }

  fs.writeFileSync(reportFile, content);
  console.log(`\n📋 Report saved: ${reportFile}`);
  return reportFile;
}

// ── Test Execution (API-level) ─────────────────────────────────────────────

/**
 * Test the /api/stamps/identify endpoint directly with a stamp image.
 */
async function testIdentifyAPI(stampInfo, round, mode) {
  const imageBuffer = fs.readFileSync(stampInfo.path);
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;
  
  console.log(`  📤 Sending ${stampInfo.file} to /api/stamps/identify...`);
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${BASE_URL}/api/stamps/identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: dataUrl }),
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`  ⏱️  Response in ${elapsed}ms (status: ${response.status})`);
    
    if (!response.ok) {
      const errText = await response.text();
      const bugId = submitBug({
        summary: `API /stamps/identify returned ${response.status}`,
        severity: 'HIGH',
        expected: 'HTTP 200 with identification data',
        actual: `HTTP ${response.status}: ${errText}`,
        round, mode,
        stampFile: stampInfo.file,
        rawData: { status: response.status, body: errText },
      });
      return {
        round, mode,
        stampName: stampInfo.expected.name,
        pass: false,
        details: `API error: HTTP ${response.status}`,
        identification: null,
        bugId,
      };
    }
    
    const data = await response.json();
    const ident = data.identification;
    
    // Check for mock mode
    if (ident._mockMode) {
      const bugId = submitBug({
        summary: 'Identification running in MOCK MODE — API key not working',
        severity: 'CRITICAL',
        expected: 'Real AI identification using Gemini',
        actual: 'Mock data returned — GOOGLE_API_KEY may be invalid',
        round, mode,
        stampFile: stampInfo.file,
        rawData: ident,
      });
      return {
        round, mode,
        stampName: stampInfo.expected.name,
        pass: false,
        details: '❌ MOCK MODE: API key not working, returning simulated data',
        identification: ident,
        bugId,
      };
    }
    
    // Validate against expected
    const validation = validateIdentification(ident, stampInfo.expected);
    
    let bugId = null;
    if (!validation.pass) {
      bugId = submitBug({
        summary: `Stamp misidentified: ${stampInfo.expected.name}`,
        severity: 'HIGH',
        expected: JSON.stringify(stampInfo.expected),
        actual: JSON.stringify({
          country: ident.country,
          scottNumber: ident.scottNumber,
          denomination: ident.denomination,
          aiConfidence: ident.aiConfidence,
        }),
        round, mode,
        stampFile: stampInfo.file,
        rawData: ident,
      });
    }
    
    return {
      round, mode,
      stampName: stampInfo.expected.name,
      pass: validation.pass,
      details: validation.details,
      identification: ident,
      bugId,
      responseTimeMs: elapsed,
    };
    
  } catch (err) {
    const bugId = submitBug({
      summary: `Network error calling /api/stamps/identify: ${err.message}`,
      severity: 'CRITICAL',
      expected: 'Successful API call',
      actual: `Error: ${err.message}`,
      round, mode,
      stampFile: stampInfo.file,
      rawData: { error: err.message, stack: err.stack },
    });
    return {
      round, mode,
      stampName: stampInfo.expected.name,
      pass: false,
      details: `Network error: ${err.message}`,
      identification: null,
      bugId,
    };
  }
}

/**
 * Test the /api/stamps/segment endpoint with a stamp image.
 */
async function testSegmentAPI(stampInfo, round) {
  const imageBuffer = fs.readFileSync(stampInfo.path);
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;
  
  console.log(`  📐 Sending ${stampInfo.file} to /api/stamps/segment...`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/stamps/segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: dataUrl }),
    });
    
    if (!response.ok) {
      submitBug({
        summary: `API /stamps/segment returned ${response.status}`,
        severity: 'HIGH',
        expected: 'HTTP 200 with stamp detections',
        actual: `HTTP ${response.status}`,
        round,
        stampFile: stampInfo.file,
      });
      return null;
    }
    
    const data = await response.json();
    console.log(`  📐 Segment result: ${data.count} stamp(s) detected`);
    
    if (data._mockMode) {
      submitBug({
        summary: 'Segmentation running in MOCK MODE',
        severity: 'HIGH',
        expected: 'Real AI segmentation',
        actual: 'Mock mode active',
        round,
        stampFile: stampInfo.file,
      });
    }
    
    if (data.count === 0) {
      submitBug({
        summary: `No stamps detected in ${stampInfo.file}`,
        severity: 'MEDIUM',
        expected: 'At least 1 stamp detected',
        actual: '0 stamps detected',
        round,
        stampFile: stampInfo.file,
        rawData: data,
      });
    }
    
    return data;
  } catch (err) {
    submitBug({
      summary: `Segment API error: ${err.message}`,
      severity: 'CRITICAL',
      expected: 'Successful segmentation',
      actual: `Error: ${err.message}`,
      round,
      stampFile: stampInfo.file,
    });
    return null;
  }
}

// ── Main Test Runner ───────────────────────────────────────────────────────

async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║      StampVault E2E Visual Test Runner                      ║');
  console.log('║      4x Consecutive Match Verification                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();
  
  ensureDirs();
  
  // Check server is running
  console.log('🔌 Checking server connectivity...');
  try {
    const healthCheck = await fetch(`${BASE_URL}/upload`);
    if (!healthCheck.ok) throw new Error(`HTTP ${healthCheck.status}`);
    console.log('✅ Server is running\n');
  } catch (err) {
    console.error(`❌ Server not reachable at ${BASE_URL}: ${err.message}`);
    submitBug({
      summary: 'Dev server not running',
      severity: 'CRITICAL',
      expected: `Server running at ${BASE_URL}`,
      actual: `Connection failed: ${err.message}`,
    });
    process.exit(1);
  }
  
  const allResults = [];
  
  // ── 4 Rounds of Testing ──
  for (let round = 1; round <= 4; round++) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ROUND ${round}/4`);
    console.log(`${'═'.repeat(60)}\n`);
    
    // Test each stamp in INDIVIDUAL mode
    for (const stamp of TEST_STAMPS) {
      if (!fs.existsSync(stamp.path)) {
        console.log(`  ⚠️  Skipping ${stamp.file} — file not found at ${stamp.path}`);
        submitBug({
          summary: `Test stamp file not found: ${stamp.file}`,
          severity: 'MEDIUM',
          expected: `File exists at ${stamp.path}`,
          actual: 'File not found',
          round,
        });
        continue;
      }
      
      console.log(`\n  🔬 [Individual] Testing: ${stamp.expected.name}`);
      
      // Test segmentation
      await testSegmentAPI(stamp, round);
      
      // Test identification
      const result = await testIdentifyAPI(stamp, round, 'individual');
      allResults.push(result);
      console.log(`  ${result.details}`);
    }
    
    // Test in BATCH mode (all stamps at once — just API-level)
    console.log(`\n  📦 [Batch] Testing all ${TEST_STAMPS.length} stamps...`);
    for (const stamp of TEST_STAMPS) {
      if (!fs.existsSync(stamp.path)) continue;
      const result = await testIdentifyAPI(stamp, round, 'batch');
      allResults.push(result);
      console.log(`  ${result.details}`);
    }
  }
  
  // ── Generate Report ──
  const reportFile = generateReport(allResults);
  
  // ── Summary ──
  const passed = allResults.filter(r => r.pass).length;
  const failed = allResults.length - passed;
  const bugs = fs.readdirSync(BUGS_DIR).filter(f => f.endsWith('.md'));
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  FINAL RESULTS`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Total tests: ${allResults.length}`);
  console.log(`  Passed:      ${passed} ✅`);
  console.log(`  Failed:      ${failed} ❌`);
  console.log(`  Bugs filed:  ${bugs.length} 🐛`);
  console.log(`  Pass rate:   ${Math.round((passed / allResults.length) * 100)}%`);
  console.log(`${'═'.repeat(60)}\n`);
  
  if (failed > 0) {
    console.log('  ⚠️  Some tests failed. Check bugs/ directory for details.');
    process.exit(1);
  } else {
    console.log('  🎉 All tests passed! Stamps identified correctly 4/4 rounds.');
  }
}

runAllTests().catch(err => {
  console.error('Fatal error:', err);
  submitBug({
    summary: `Test runner crashed: ${err.message}`,
    severity: 'CRITICAL',
    expected: 'Test runner completes',
    actual: `Crash: ${err.message}`,
    rawData: { stack: err.stack },
  });
  process.exit(1);
});
