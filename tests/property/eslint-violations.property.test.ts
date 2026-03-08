/**
 * Property-Based Test for ESLint Violations Bug Condition
 * 
 * **Feature: eslint-cleanup**
 * 
 * This test verifies Property 1 (Bug Condition) defined in the design document:
 * ESLint violations exist in the codebase and block git commits.
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * **DO NOT attempt to fix the test or the code when it fails.**
 * **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation.
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**
 */

import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'
import path from 'path'

/**
 * **Property 1: Bug Condition - ESLint Violations Resolved**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**
 * 
 * Property: For any source file where ESLint detects violations (isBugCondition returns true),
 * the fixed codebase SHALL have zero ESLint errors and warnings, allowing git commits to proceed.
 * 
 * Bug Condition (Current Behavior - UNFIXED):
 *   eslintViolationCount > 0 AND gitCommitBlocked = true
 * 
 * Expected Behavior (After Fix):
 *   eslintViolationCount = 0 AND gitCommitBlocked = false
 * 
 * This test runs on UNFIXED code and is EXPECTED TO FAIL, proving the bug exists.
 */
describe('Property 1: Bug Condition - ESLint Violations Resolved', () => {
  const projectRoot = path.resolve(__dirname, '../..')

  it('should have zero ESLint violations (EXPECTED TO FAIL on unfixed code)', () => {
    let eslintOutput = ''
    let eslintExitCode = 0

    try {
      // Run ESLint on the source directory
      // Using --format json to get structured output
      eslintOutput = execSync('npm run lint:check', {
        cwd: projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe'
      })
    } catch (error: unknown) {
      // ESLint exits with non-zero code when violations are found
      const execError = error as { status?: number }
      eslintExitCode = execError.status || 1
      eslintOutput = error.stdout || error.stderr || ''
    }

    // Parse the output to count violations
    const errorMatch = eslintOutput.match(/(\d+)\s+error/i)
    const warningMatch = eslintOutput.match(/(\d+)\s+warning/i)
    
    const errorCount = errorMatch ? parseInt(errorMatch[1], 10) : 0
    const warningCount = warningMatch ? parseInt(warningMatch[1], 10) : 0
    const totalViolations = errorCount + warningCount

    // Document the counterexamples found
    console.log('\n=== ESLint Violation Report ===')
    console.log(`Total Violations: ${totalViolations}`)
    console.log(`Errors: ${errorCount}`)
    console.log(`Warnings: ${warningCount}`)
    console.log(`Git Commit Blocked: ${eslintExitCode !== 0}`)
    
    // Extract specific violation types from output
    const unusedVarsMatch = eslintOutput.match(/@typescript-eslint\/no-unused-vars/g)
    const consoleMatch = eslintOutput.match(/no-console/g)
    const anyTypeMatch = eslintOutput.match(/@typescript-eslint\/no-explicit-any/g)
    const terminologyMatch = eslintOutput.match(/no-restricted-syntax/g)
    
    console.log('\nViolation Categories:')
    console.log(`- Unused variables/imports: ${unusedVarsMatch ? unusedVarsMatch.length : 0}`)
    console.log(`- Console statements: ${consoleMatch ? consoleMatch.length : 0}`)
    console.log(`- Any types: ${anyTypeMatch ? anyTypeMatch.length : 0}`)
    console.log(`- Terminology issues: ${terminologyMatch ? terminologyMatch.length : 0}`)
    
    // Show sample violations (first few lines)
    const outputLines = eslintOutput.split('\n').slice(0, 50)
    console.log('\nSample Violations (first 50 lines):')
    console.log(outputLines.join('\n'))
    console.log('================================\n')

    // Expected Behavior: Zero violations and commits allowed
    // On UNFIXED code, this assertion will FAIL (which is correct - proves bug exists)
    // On FIXED code, this assertion will PASS (which confirms the fix works)
    expect(totalViolations, 
      `Expected 0 ESLint violations but found ${totalViolations} (${errorCount} errors, ${warningCount} warnings). ` +
      `This is the bug condition - ESLint violations block git commits.`
    ).toBe(0)
    
    expect(eslintExitCode,
      `Expected ESLint to exit with code 0 (success) but got ${eslintExitCode}. ` +
      `This indicates git commits are blocked by ESLint violations.`
    ).toBe(0)
  })

  it('should categorize violations by type', () => {
    let eslintOutput = ''

    try {
      eslintOutput = execSync('npm run lint:check', {
        cwd: projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe'
      })
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string }
      eslintOutput = execError.stdout || execError.stderr || ''
    }

    // Count each violation category
    const unusedVarsCount = (eslintOutput.match(/@typescript-eslint\/no-unused-vars/g) || []).length
    const consoleCount = (eslintOutput.match(/no-console/g) || []).length
    const anyTypeCount = (eslintOutput.match(/@typescript-eslint\/no-explicit-any/g) || []).length
    const terminologyCount = (eslintOutput.match(/no-restricted-syntax/g) || []).length

    console.log('\n=== Violation Category Breakdown ===')
    console.log(`Unused variables/imports: ${unusedVarsCount}`)
    console.log(`Console statements: ${consoleCount}`)
    console.log(`Any types: ${anyTypeCount}`)
    console.log(`Terminology issues: ${terminologyCount}`)
    console.log('====================================\n')

    // Expected: All categories should be zero after fix
    // On UNFIXED code, these will be > 0 (proving bug exists)
    expect(unusedVarsCount, 'Expected 0 unused variable/import violations').toBe(0)
    expect(consoleCount, 'Expected 0 console statement violations').toBe(0)
    expect(anyTypeCount, 'Expected 0 any type violations').toBe(0)
    expect(terminologyCount, 'Expected 0 terminology violations').toBe(0)
  })

  it('should verify git commit is not blocked', () => {
    let gitCommitBlocked = false

    try {
      // Run the pre-commit hook check (lint-staged would run ESLint)
      execSync('npm run lint:check', {
        cwd: projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe'
      })
      gitCommitBlocked = false
    } catch (error: unknown) {
      // If ESLint fails, git commit would be blocked
      gitCommitBlocked = true
    }

    console.log('\n=== Git Commit Status ===')
    console.log(`Git Commit Blocked: ${gitCommitBlocked}`)
    console.log('=========================\n')

    // Expected: Git commits should NOT be blocked (gitCommitBlocked = false)
    // On UNFIXED code, this will be true (proving bug exists)
    expect(gitCommitBlocked, 
      'Expected git commits to be allowed, but ESLint violations are blocking commits. ' +
      'This is the bug condition.'
    ).toBe(false)
  })
})

/**
 * Counterexamples Documentation
 * 
 * When this test runs on UNFIXED code, it will document specific counterexamples:
 * 
 * 1. Files with unused imports (e.g., import statements that are never used)
 * 2. Files with unused variables (e.g., const declarations that are never referenced)
 * 3. Files with console.log statements (e.g., debug logging in production code)
 * 4. Files with any types (e.g., function parameters typed as 'any')
 * 5. Files with terminology issues (e.g., 'strategicTask' instead of 'plan')
 * 
 * These counterexamples prove the bug exists and provide concrete examples
 * of the violations that need to be fixed.
 * 
 * Expected Test Result on UNFIXED code:
 * - Test FAILS ✗
 * - Shows ~891 violations (472 errors, 419 warnings)
 * - Documents specific files and violation types
 * - Confirms git commits are blocked
 * 
 * Expected Test Result on FIXED code:
 * - Test PASSES ✓
 * - Shows 0 violations
 * - Confirms git commits are allowed
 */
