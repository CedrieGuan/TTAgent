/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.ttagent.app',
  productName: 'TTAgent',
  copyright: 'Copyright © 2026 TTAgent',
  directories: {
    buildResources: 'resources',
    output: 'dist'
  },
  files: ['out/**'],
  extraResources: [{ from: 'resources/', to: 'resources/', filter: ['**/*'] }],
  mac: {
    target: [{ target: 'dmg', arch: ['x64', 'arm64'] }],
    icon: 'resources/icon.icns',
    category: 'public.app-category.productivity',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'resources/entitlements.mac.plist',
    entitlementsInherit: 'resources/entitlements.mac.plist',
    notarize: false
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'resources/icon.ico'
  },
  linux: {
    target: [{ target: 'AppImage', arch: ['x64'] }],
    icon: 'resources/icon.png',
    category: 'Utility'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true
  },
  publish: {
    provider: 'github',
    owner: 'your-github-username',
    repo: 'TTAgent'
  }
}
