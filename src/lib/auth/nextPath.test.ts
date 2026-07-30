import { safeNextPath } from './nextPath'

describe('safeNextPath', () => {
  test('passes root-relative paths through untouched', () => {
    expect(safeNextPath('/')).toBe('/')
    expect(safeNextPath('/portal')).toBe('/portal')
    expect(safeNextPath('/portal/project-1?tab=files#comments')).toBe(
      '/portal/project-1?tab=files#comments',
    )
  })

  test('rejects protocol-relative and backslash variants', () => {
    expect(safeNextPath('//attacker.example')).toBe('/')
    expect(safeNextPath('/\\attacker.example')).toBe('/')
    expect(safeNextPath('//attacker.example/portal', '/portal')).toBe('/portal')
  })

  test('rejects absolute and scheme-bearing targets', () => {
    expect(safeNextPath('https://attacker.example')).toBe('/')
    expect(safeNextPath('javascript:alert(1)')).toBe('/')
  })

  test('rejects host-reparse tricks that do not start with a slash', () => {
    expect(safeNextPath('@attacker.example')).toBe('/')
    expect(safeNextPath('.attacker.example')).toBe('/')
    expect(safeNextPath(':8080@attacker.example')).toBe('/')
  })

  test('rejects control characters the URL parser would strip', () => {
    expect(safeNextPath('/\t/attacker.example')).toBe('/')
    expect(safeNextPath('/\n//attacker.example')).toBe('/')
    expect(safeNextPath('/portal\r\nSet-Cookie: x=1')).toBe('/')
  })

  test('falls back for non-string input', () => {
    expect(safeNextPath(undefined)).toBe('/')
    expect(safeNextPath(null, '/portal')).toBe('/portal')
    expect(safeNextPath(42)).toBe('/')
  })
})
