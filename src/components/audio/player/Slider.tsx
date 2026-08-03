'use client'

function parseTime(seconds: number): [number, number, number] {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds - hours * 3600) / 60)
  seconds = seconds - hours * 3600 - minutes * 60
  return [hours, minutes, seconds]
}

function formatHumanTime(seconds: number): string {
  const [h, m, s] = parseTime(seconds)
  return `${h} hour${h === 1 ? '' : 's'}, ${m} minute${
    m === 1 ? '' : 's'
  }, ${s} second${s === 1 ? '' : 's'}`
}

export { formatHumanTime }
