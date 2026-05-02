const { createDMG } = require('electron-installer-dmg');
const path = require('path');
const fs = require('fs');

async function buildDMG() {
  // Find the packaged app
  const outDir = path.join(__dirname, '..', 'out');
  const appName = 'AnyoneVPN';
  
  // Look for the app in different possible locations
  let appPath = null;
  const possiblePaths = [
    path.join(outDir, `${appName}-darwin-arm64`, `${appName}.app`),
    path.join(outDir, `${appName}-darwin-x64`, `${appName}.app`),
    path.join(outDir, `${appName}-macos-arm64`, `${appName}.app`),
    path.join(outDir, `${appName}-macos-x64`, `${appName}.app`)
  ];

  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      appPath = possiblePath;
      break;
    }
  }

  if (!appPath) {
    console.error('❌ App not found! Please run electron-packager or nextron build first.');
    console.log('Looking in:', outDir);
    console.log('Expected paths:', possiblePaths);
    return;
  }

  console.log(`✅ Found app at: ${appPath}`);

  // Create DMG path
  const dmgPath = path.join(outDir, `${appName}-1.0.0.dmg`);
  
  // DMG configuration
  const options = {
    appPath: appPath,
    dmgPath: dmgPath,
    background: path.join(__dirname, '..', 'resources', 'logo-white.png'),
    icon: path.join(__dirname, '..', 'resources', 'icon.icns'),
    title: 'Anyone VPN',
    contents: [
      {
        x: 130,
        y: 220,
        type: 'file',
        path: appPath
      },
      {
        x: 410,
        y: 220,
        type: 'link',
        path: '/Applications'
      }
    ],
    window: {
      width: 540,
      height: 380
    },
    format: 'ULFO'
  };

  try {
    console.log('🚀 Creating DMG...');
    await createDMG(options);
    console.log(`✅ DMG created successfully at: ${dmgPath}`);
  } catch (error) {
    console.error('❌ Error creating DMG:', error);
    process.exit(1);
  }
}

buildDMG(); 