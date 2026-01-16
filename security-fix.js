const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔒 Starting security vulnerability fixes...\n');

try {
  // Check current vulnerable packages
  console.log('📋 Current vulnerable packages:');
  console.log('1. multer@1.4.5-lts.2 - 2 HIGH vulnerabilities');
  console.log('2. new-folder@1.0.0 - 3 vulnerabilities (2 HIGH, 1 LOW)');
  console.log('3. bcrypt@5.1.1 - 1 LOW vulnerability');
  console.log('4. nodemon@3.1.9 - 1 LOW vulnerability\n');

  // Update multer (most critical)
  console.log('🔄 Updating multer...');
  execSync('npm install multer@latest', { stdio: 'inherit' });
  
  // Update bcrypt
  console.log('🔄 Updating bcrypt...');
  execSync('npm install bcrypt@latest', { stdio: 'inherit' });
  
  // Update nodemon
  console.log('🔄 Updating nodemon...');
  execSync('npm install nodemon@latest --save-dev', { stdio: 'inherit' });
  
  // Find what uses new-folder
  console.log('🔍 Checking new-folder dependencies...');
  try {
    const result = execSync('npm ls new-folder', { encoding: 'utf8' });
    console.log('Dependency tree for new-folder:');
    console.log(result);
  } catch (e) {
    console.log('new-folder not found in direct dependencies');
  }

  console.log('\n✅ Security updates completed!');
  console.log('\n📝 Next steps:');
  console.log('1. Run: npm audit fix --force');
  console.log('2. Test your application: npx nodemon');
  console.log('3. Consider replacing new-folder if possible');
  
} catch (error) {
  console.error('❌ Error during security update:', error.message);
}