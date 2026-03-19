const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');
const glob = require('glob');

console.log('Testing Swagger Configuration...\n');

// Test with different path patterns
const patterns = [
  './src/modules/*/routes/*.ts',
  './dist/modules/*/routes/*.js',
  path.join(__dirname, 'src/modules/*/routes/*.ts'),
  path.join(__dirname, 'dist/modules/*/routes/*.js'),
];

console.log('📁 Current directory:', __dirname);
console.log('\n🔍 Testing path patterns:\n');

patterns.forEach(pattern => {
  console.log(`Pattern: ${pattern}`);
  const files = glob.sync(pattern);
  console.log(`Found ${files.length} files`);
  if (files.length > 0) {
    console.log('First 3 files:');
    files.slice(0, 3).forEach(f => console.log(`  - ${f}`));
  }
  console.log('');
});

// Try to generate the spec
console.log('📚 Generating Swagger spec...\n');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Test API',
      version: '1.0.0',
    },
  },
  apis: [
    path.join(__dirname, 'src/modules/*/routes/*.ts'),
    path.join(__dirname, 'dist/modules/*/routes/*.js'),
  ],
};

try {
  const spec = swaggerJsdoc(options);
  const pathCount = Object.keys(spec.paths || {}).length;
  console.log(`✅ Success! Generated ${pathCount} API endpoints`);

  if (pathCount > 0) {
    console.log('\nSample endpoints:');
    Object.keys(spec.paths).slice(0, 5).forEach(path => {
      console.log(`  - ${path}`);
    });
  } else {
    console.log('\n⚠️  No endpoints found! The JSDoc comments might not be formatted correctly.');
  }
} catch (error) {
  console.error('❌ Error generating spec:', error.message);
}
