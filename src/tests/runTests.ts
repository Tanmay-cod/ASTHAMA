import { runClinicalCalculationsTestSuite } from './clinicalCalculations.test';

console.log('====================================================');
console.log('Clinical Validation & Model Test Suite');
console.log('====================================================');

const result = runClinicalCalculationsTestSuite();

result.tests.forEach((t, i) => {
  const icon = t.passed ? '✓ PASS' : '✗ FAIL';
  console.log(`[${i + 1}] ${icon}: ${t.name}`);
  if (!t.passed) {
    console.log(`    Expected: ${t.expected}`);
    console.log(`    Actual:   ${t.actual}`);
  }
});

console.log('----------------------------------------------------');
if (result.allPassed) {
  console.log(`ALL ${result.tests.length} TESTS PASSED SUCCESSFULLY.`);
  console.log('Mathematical integrity of clinical formulas & decision forest verified.');
} else {
  console.error(`SOME TESTS FAILED! Check outputs above.`);
  process.exit(1);
}
console.log('====================================================');
