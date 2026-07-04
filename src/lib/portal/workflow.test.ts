import { describe, expect, test } from 'vitest'
import {
  PROJECT_STATUSES,
  NOTIFIABLE_STATUSES,
  canonicalStatus,
  canTransition,
  canUploadStems,
  canUploadMix,
  getStepForStatus,
  getUnlockedSteps,
  getStatusDisplay,
  getProgressStage,
  isNotifiableStatus,
  isProjectStatus,
  type Actor,
  type ProjectStatus,
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

describe('canonicalStatus', () => {
  test.each([
    ['pending_payment', 'pending_payment'],
    ['uploading', 'uploading'],
    ['in_review', 'in_review'],
    ['processing', 'mixing'],
    ['mixing', 'mixing'],
    ['review', 'review'],
    ['revision', 'revision'],
    ['approved', 'approved'],
    ['delivered', 'delivered'],
  ] as const)('%s → %s', (status, expected) => {
    expect(canonicalStatus(status)).toBe(expected)
  })
})

// Every legal (from, to, actor) triple. The exhaustive sweep below asserts
// the table contains exactly these edges and nothing else.
const LEGAL_TRANSITIONS: ReadonlyArray<[ProjectStatus, ProjectStatus, Actor]> = [
  ['pending_payment', 'uploading', 'system'],
  ['uploading', 'in_review', 'client'],
  ['uploading', 'in_review', 'studio'],
  ['in_review', 'mixing', 'studio'],
  ['processing', 'review', 'studio'],
  ['mixing', 'review', 'studio'],
  ['review', 'revision', 'studio'],
  ['review', 'approved', 'studio'],
  ['review', 'delivered', 'studio'],
  ['revision', 'review', 'studio'],
  ['revision', 'delivered', 'studio'],
  ['approved', 'delivered', 'studio'],
]

describe('canTransition', () => {
  test.each(LEGAL_TRANSITIONS)('allows %s → %s for %s', (from, to, actor) => {
    expect(canTransition(from, to, actor)).toBe(true)
  })

  test('the client cannot drag a delivered project back to in_review', () => {
    expect(canTransition('delivered', 'in_review', 'client')).toBe(false)
  })

  test('the client cannot self-promote pending_payment to uploading', () => {
    expect(canTransition('pending_payment', 'uploading', 'client')).toBe(false)
  })

  test('the studio cannot send in_review for review (no mix exists yet)', () => {
    expect(canTransition('in_review', 'review', 'studio')).toBe(false)
  })

  test('no actor may transition a status to itself', () => {
    for (const status of PROJECT_STATUSES) {
      for (const actor of ['client', 'studio', 'system'] as const) {
        expect(canTransition(status, status, actor)).toBe(false)
      }
    }
  })

  test('nothing may target pending_payment or the legacy processing value', () => {
    for (const from of PROJECT_STATUSES) {
      for (const actor of ['client', 'studio', 'system'] as const) {
        expect(canTransition(from, 'pending_payment', actor)).toBe(false)
        expect(canTransition(from, 'processing', actor)).toBe(false)
      }
    }
  })

  test('matches the legal-edge list exhaustively (9 × 9 × 3)', () => {
    const legal = new Set(LEGAL_TRANSITIONS.map((edge) => edge.join('→')))
    for (const from of PROJECT_STATUSES) {
      for (const to of PROJECT_STATUSES) {
        for (const actor of ['client', 'studio', 'system'] as const) {
          expect(canTransition(from, to, actor)).toBe(
            legal.has([from, to, actor].join('→')),
          )
        }
      }
    }
  })
})

describe('canUploadStems', () => {
  test.each([
    ['pending_payment', false],
    ['uploading', true],
    ['in_review', false],
    ['processing', false],
    ['mixing', false],
    ['review', false],
    ['revision', false],
    ['approved', false],
    ['delivered', false],
  ] as const)('%s → %s', (status, expected) => {
    expect(canUploadStems(status)).toBe(expected)
  })
})

describe('canUploadMix', () => {
  test.each([
    ['pending_payment', false],
    ['uploading', false],
    ['in_review', false],
    ['processing', true],
    ['mixing', true],
    ['review', true],
    ['revision', true],
    ['approved', false],
    ['delivered', false],
  ] as const)('%s → %s', (status, expected) => {
    expect(canUploadMix(status)).toBe(expected)
  })
})

describe('isProjectStatus', () => {
  test('accepts every known status', () => {
    for (const status of PROJECT_STATUSES) {
      expect(isProjectStatus(status)).toBe(true)
    }
  })

  test.each([['bogus'], [''], [42], [null], [undefined]])(
    'rejects %s',
    (value) => {
      expect(isProjectStatus(value)).toBe(false)
    },
  )
})

describe('NOTIFIABLE_STATUSES', () => {
  test('contains exactly the statuses that email the client', () => {
    expect(NOTIFIABLE_STATUSES).toEqual([
      'in_review',
      'processing',
      'mixing',
      'review',
      'delivered',
    ])
  })

  test('isNotifiableStatus agrees with the list for every status', () => {
    for (const status of PROJECT_STATUSES) {
      expect(isNotifiableStatus(status)).toBe(
        (NOTIFIABLE_STATUSES as readonly string[]).includes(status),
      )
    }
    expect(isNotifiableStatus('bogus')).toBe(false)
  })
})
