import { describe, expect, test } from 'vitest'
import {
  PROJECT_STATUSES,
  getStepForStatus,
  getUnlockedSteps,
  getStatusDisplay,
  getProgressStage,
} from './workflow'

describe('PROJECT_STATUSES', () => {
  test('contains all 8 valid statuses in order', () => {
    expect(PROJECT_STATUSES).toEqual([
      'uploading',
      'in_review',
      'processing',
      'mixing',
      'review',
      'revision',
      'approved',
      'delivered',
    ])
  })
})

describe('getStepForStatus', () => {
  test.each([
    ['uploading', 'upload'],
    ['in_review', 'upload'],
    ['processing', 'upload'],
    ['mixing', 'upload'],
    ['review', 'listen'],
    ['revision', 'listen'],
    ['approved', 'deliver'],
    ['delivered', 'deliver'],
  ] as const)('%s → %s', (status, expected) => {
    expect(getStepForStatus(status)).toBe(expected)
  })
})

describe('getUnlockedSteps', () => {
  describe('client role', () => {
    test.each([
      ['uploading', ['upload']],
      ['in_review', ['upload']],
      ['processing', ['upload']],
      ['mixing', ['upload']],
      ['review', ['upload', 'listen']],
      ['revision', ['upload', 'listen']],
      ['approved', ['upload', 'listen', 'deliver']],
      ['delivered', ['upload', 'listen', 'deliver']],
    ] as const)('%s', (status, expected) => {
      expect(getUnlockedSteps(status, 'client')).toEqual(expected)
    })
  })

  describe('studio role', () => {
    test.each([
      ['uploading', ['upload']],
      ['in_review', ['upload']],
      ['processing', ['upload']],
      ['mixing', ['upload']],
      ['review', ['upload', 'listen', 'deliver']],
      ['revision', ['upload', 'listen', 'deliver']],
      ['approved', ['upload', 'listen', 'deliver']],
      ['delivered', ['upload', 'listen', 'deliver']],
    ] as const)('%s', (status, expected) => {
      expect(getUnlockedSteps(status, 'studio')).toEqual(expected)
    })
  })

  test('studio unlocks deliver during review/revision, client does not', () => {
    expect(getUnlockedSteps('review', 'studio')).toContain('deliver')
    expect(getUnlockedSteps('review', 'client')).not.toContain('deliver')
    expect(getUnlockedSteps('revision', 'studio')).toContain('deliver')
    expect(getUnlockedSteps('revision', 'client')).not.toContain('deliver')
  })

  test('upload is always unlocked for every status and role', () => {
    for (const status of PROJECT_STATUSES) {
      expect(getUnlockedSteps(status, 'client')).toContain('upload')
      expect(getUnlockedSteps(status, 'studio')).toContain('upload')
    }
  })
})

describe('getStatusDisplay', () => {
  test.each([
    ['uploading', 'Uploading'],
    ['in_review', 'In Review'],
    ['processing', 'Mixing'],
    ['mixing', 'Mixing'],
    ['review', 'Mix Available'],
    ['revision', 'Revision'],
    ['approved', 'Approved'],
    ['delivered', 'Delivered'],
  ] as const)('%s has label %s', (status, label) => {
    expect(getStatusDisplay(status).label).toBe(label)
  })

  test('returns a non-empty color string for every status', () => {
    for (const status of PROJECT_STATUSES) {
      expect(getStatusDisplay(status).color.length).toBeGreaterThan(0)
    }
  })
})

describe('getProgressStage', () => {
  test.each([
    ['uploading', 'uploaded'],
    ['in_review', 'uploaded'],
    ['processing', 'in_progress'],
    ['mixing', 'in_progress'],
    ['review', 'mixed'],
    ['revision', 'mixed'],
    ['approved', 'complete'],
    ['delivered', 'complete'],
  ] as const)('%s → %s', (status, expected) => {
    expect(getProgressStage(status)).toBe(expected)
  })
})
