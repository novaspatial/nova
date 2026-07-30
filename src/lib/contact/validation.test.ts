import { CONTACT_LIMITS, validateContactInput } from './validation'

const valid = {
  name: 'Ada',
  email: 'ada@example.com',
  subject: 'Atmos mix',
  message: 'Four songs, stems ready.',
}

describe('validateContactInput', () => {
  test('accepts and trims a well-formed submission', () => {
    const { input, error } = validateContactInput({
      ...valid,
      name: '  Ada  ',
      message: ' Four songs. ',
    })
    expect(error).toBeNull()
    expect(input).toEqual({
      name: 'Ada',
      email: 'ada@example.com',
      subject: 'Atmos mix',
      message: 'Four songs.',
    })
  })

  test('nulls an empty subject rather than storing an empty string', () => {
    const { input } = validateContactInput({ ...valid, subject: '   ' })
    expect(input?.subject).toBeNull()
  })

  test.each([
    ['missing name', { ...valid, name: undefined }],
    ['blank message', { ...valid, message: '   ' }],
    ['non-object body', 'not-an-object'],
    ['null body', null],
  ])('rejects %s', (_label, body) => {
    expect(validateContactInput(body).input).toBeNull()
  })

  test.each([
    'no-at-sign',
    'two@@example.com',
    'spaces in@example.com',
    'missing@tld',
  ])('rejects the malformed address %s', (email) => {
    const { input, error } = validateContactInput({ ...valid, email })
    expect(input).toBeNull()
    expect(error).toBe('Enter a valid email address.')
  })

  test('rejects header injection in the fields that become mail headers', () => {
    expect(
      validateContactInput({
        ...valid,
        email: 'ada@example.com\r\nBcc: victim@example.com',
      }).input,
    ).toBeNull()
    expect(
      validateContactInput({ ...valid, subject: 'Hi\nBcc: victim@example.com' })
        .input,
    ).toBeNull()
    expect(validateContactInput({ ...valid, name: 'Ada\r\nX: 1' }).input).toBeNull()
  })

  test.each([
    ['name', CONTACT_LIMITS.name],
    ['subject', CONTACT_LIMITS.subject],
    ['message', CONTACT_LIMITS.message],
  ])('caps %s length', (field, limit) => {
    const { input } = validateContactInput({
      ...valid,
      [field]: 'x'.repeat(limit + 1),
    })
    expect(input).toBeNull()
  })

  test('keeps newlines in the message body', () => {
    const { input } = validateContactInput({
      ...valid,
      message: 'Line one\nLine two',
    })
    expect(input?.message).toBe('Line one\nLine two')
  })
})
