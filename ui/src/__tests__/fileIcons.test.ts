import { describe, it, expect } from 'vitest'
import { getFileIconType } from '@/lib/fileIcons'

describe('getFileIconType', () => {
  it('returns typescript for .ts files', () => {
    expect(getFileIconType('index.ts')).toBe('typescript')
  })

  it('returns typescript for .tsx files', () => {
    expect(getFileIconType('App.tsx')).toBe('typescript')
  })

  it('returns javascript for .js files', () => {
    expect(getFileIconType('server.js')).toBe('javascript')
  })

  it('returns json for .json files', () => {
    expect(getFileIconType('data.json')).toBe('json')
  })

  it('returns npm for package.json (exact filename match)', () => {
    expect(getFileIconType('package.json')).toBe('npm')
  })

  it('returns typescript for tsconfig.json', () => {
    expect(getFileIconType('tsconfig.json')).toBe('typescript')
  })

  it('returns git for .gitignore', () => {
    expect(getFileIconType('.gitignore')).toBe('git')
  })

  it('returns markdown for .md files', () => {
    expect(getFileIconType('README.md')).toBe('readme')
    expect(getFileIconType('CHANGELOG.md')).toBe('markdown')
  })

  it('returns image for image files', () => {
    expect(getFileIconType('logo.png')).toBe('image')
    expect(getFileIconType('icon.svg')).toBe('image')
  })

  it('returns css for .css files', () => {
    expect(getFileIconType('styles.css')).toBe('css')
  })

  it('returns file for unknown extensions', () => {
    expect(getFileIconType('data.xyz')).toBe('file')
  })

  it('returns file for files with no extension', () => {
    expect(getFileIconType('Makefile')).toBe('config')
    expect(getFileIconType('somefile')).toBe('file')
  })

  it('handles case insensitivity for extensions', () => {
    expect(getFileIconType('image.PNG')).toBe('image')
  })

  it('returns shell for shell scripts', () => {
    expect(getFileIconType('deploy.sh')).toBe('shell')
  })

  it('returns python for .py files', () => {
    expect(getFileIconType('app.py')).toBe('python')
  })
})
