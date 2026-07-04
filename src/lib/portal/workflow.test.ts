import { describe, expect, test } from 'vitest'
import {
  PROJECT_STATUSES,
  getStepForStatus,
  getUnlockedSteps,
  getStatusDisplay,
  getProgressStage,
} from './workflow'

describe('PROJECT_STATUSES', () => {
  test('contains all valid statuses in lifecycle order', () => {
    expect(PROJECT_STATUSES).toEqual([
      'pending_payment',
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
    ['pending_payment', 'upload'],
    ['uploading', 'upload'],
    ['in_review', 'upload'],
    ['processing', 'upload'],
    ['mixing', 'upload'],
    ['review', 'listen'],
    ['revision', 'listen'],
    ['approved', 'listen'],
    ['delivered', 'listen'],
  ] as const)('%s → %s', (status, expected) => {
    expect(getStepForStatus(status)).toBe(expected)
  })
})

describe('getUnlockedSteps', () => {
  describe('client role', () => {
    test.each([
      ['pending_payment', []],
      ['uploading', ['upload']],
      ['in_review', ['upload']],
      ['processing', ['upload']],
      ['mixing', ['upload']],
      ['review', ['upload', 'listen']],
      ['revision', ['upload', 'listen']],
      ['approved', ['upload', 'listen']],
      ['delivered', ['upload', 'listen']],
    ] as const)('%s', (status, expected) => {
      expect(getUnlockedSteps(status, 'client')).toEqual(expected)
    })
  })

  describe('studio role', () => {
    test.each([
      ['pending_payment', []],
      ['uploading', ['upload']],
      ['in_review', ['upload']],
      ['processing', ['upload']],
      ['mixing', ['upload']],
      ['review', ['upload', 'listen']],
      ['revision', ['upload', 'listen']],
      ['approved', ['upload', 'listen']],
      ['delivered', ['upload', 'listen']],
    ] as const)('%s', (status, expected) => {
      expect(getUnlockedSteps(status, 'studio')).toEqual(expected)
    })
  })

  test('no steps are unlocked while payment is pending', () => {
    expect(getUnlockedSteps('pending_payment', 'client')).toEqual([])
    expect(getUnlockedSteps('pending_payment', 'studio')).toEqual([])
  })

  test('upload is unlocked for every status once payment clears', () => {
    for (const status of PROJECT_STATUSES) {
      if (status === 'pending_payment') continue
      expect(getUnlockedSteps(status, 'client')).toContain('upload')
      expect(getUnlockedSteps(status, 'studio')).toContain('upload')
    }
  })
})

describe('getStatusDisplay', () => {
  test.each([
    ['pending_payment', 'Pending Payment'],
    ['uploading', 'Awaiting Stems'],
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
    ['pending_payment', 'uploaded'],
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
