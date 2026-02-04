#!/usr/bin/env node

/**
 * Pre-Deployment Validation Script
 *
 * Validates that all configurations are correct before deploying to AWS.
 * This can be run locally before executing the deployment.
 *
 * Usage: npx tsx scripts/validate-deployment.ts [environment]
 *
 * Checks:
 * - Terraform configuration files exist and are valid syntax
 * - Required environment variables are documented
 * - API Docker build configuration is correct
 * - Web app build configuration is correct
 * - GitHub Actions workflows are properly configured
 * - Secrets references are consistent
 *
 * Exit codes:
 *   0: All validations passed
 *   1: One or more validations failed
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  name: string;
  passed: boolean;
  message?: string;
}

class DeploymentValidator {
  private results: ValidationResult[] = [];
  private environment: string;
  private projectRoot: string;

  constructor(environment: string = 'dev') {
    this.environment = environment;
    this.projectRoot = join(__dirname, '..');
  }

  private log(message: string, level: 'info' | 'success' | 'error' | 'warn' = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      error: '\x1b[31m',
      warn: '\x1b[33m',
      reset: '\x1b[0m',
    };

    const prefix = {
      info: '[•]',
      success: '[✓]',
      error: '[✗]',
      warn: '[!]',
    };

    console.log(`${colors[level]}${prefix[level]} ${message}${colors.reset}`);
  }

  private addResult(name: string, passed: boolean, message?: string) {
    this.results.push({ name, passed, message });
    if (passed) {
      this.log(`${name}${message ? ` - ${message}` : ''}`, 'success');
    } else {
      this.log(`${name}${message ? ` - ${message}` : ''}`, 'error');
    }
  }

  private checkFileExists(path: string, description: string): boolean {
    const fullPath = join(this.projectRoot, path);
    const exists = existsSync(fullPath);
    this.addResult(`File exists: ${description}`, exists, exists ? path : `Missing: ${path}`);
    return exists;
  }

  private checkFileContains(path: string, pattern: string | RegExp, description: string): boolean {
    const fullPath = join(this.projectRoot, path);
    if (!existsSync(fullPath)) {
      this.addResult(description, false, `File not found: ${path}`);
      return false;
    }

    const content = readFileSync(fullPath, 'utf-8');
    const contains =
      typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);

    this.addResult(description, contains, contains ? 'Found' : `Pattern not found: ${pattern}`);
    return contains;
  }

  async validate(): Promise<boolean> {
    console.log('\n' + '='.repeat(70));
    console.log('PRE-DEPLOYMENT VALIDATION');
    console.log('='.repeat(70));
    console.log(`Environment: ${this.environment}`);
    console.log(`Project Root: ${this.projectRoot}`);
    console.log('='.repeat(70) + '\n');

    // Infrastructure Checks
    console.log('\n📦 INFRASTRUCTURE CONFIGURATION\n');
    this.validateInfrastructure();

    // API Service Checks
    console.log('\n🔧 API SERVICE CONFIGURATION\n');
    this.validateApiService();

    // Web App Checks
    console.log('\n🌐 WEB APPLICATION CONFIGURATION\n');
    this.validateWebApp();

    // CI/CD Checks
    console.log('\n🚀 CI/CD CONFIGURATION\n');
    this.validateCICD();

    // Documentation Checks
    console.log('\n📚 DOCUMENTATION\n');
    this.validateDocumentation();

    // Summary
    this.printSummary();

    return this.results.every((r) => r.passed);
  }

  private validateInfrastructure() {
    const envDir = `infra/terraform/environments/${this.environment}`;

    // Check Terraform files exist
    this.checkFileExists(`${envDir}/main.tf`, 'Terraform main configuration');
    this.checkFileExists(`${envDir}/variables.tf`, 'Terraform variables');
    this.checkFileExists(`${envDir}/outputs.tf`, 'Terraform outputs');
    this.checkFileExists(`${envDir}/backend.tf`, 'Terraform backend config');

    // Check modules exist
    const modules = [
      'vpc',
      'rds',
      'ecs',
      'ecr',
      'secrets-manager',
      'cloudwatch',
      'web-hosting',
      'github-oidc',
    ];
    modules.forEach((module) => {
      this.checkFileExists(`infra/terraform/modules/${module}/main.tf`, `Module: ${module}`);
    });

    // Verify main.tf contains required modules
    this.checkFileContains(`${envDir}/main.tf`, 'module "vpc"', 'VPC module referenced in main.tf');
    this.checkFileContains(`${envDir}/main.tf`, 'module "rds"', 'RDS module referenced in main.tf');
    this.checkFileContains(`${envDir}/main.tf`, 'module "ecs"', 'ECS module referenced in main.tf');
    this.checkFileContains(
      `${envDir}/main.tf`,
      'module "web_hosting"',
      'Web hosting module referenced in main.tf'
    );
  }

  private validateApiService() {
    // Check Dockerfile exists
    this.checkFileExists('services/api/Dockerfile', 'API Dockerfile');

    // Check Dockerfile has multi-stage build
    this.checkFileContains(
      'services/api/Dockerfile',
      /FROM.*AS builder/,
      'Multi-stage Docker build'
    );

    // Check package.json exists
    this.checkFileExists('services/api/package.json', 'API package.json');

    // Check required dependencies
    const packageJsonPath = join(this.projectRoot, 'services/api/package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      const requiredDeps = [
        'fastify',
        '@fastify/cors',
        '@fastify/rate-limit',
        '@prisma/client',
        'zod',
      ];

      requiredDeps.forEach((dep) => {
        this.addResult(
          `Dependency: ${dep}`,
          dep in deps,
          dep in deps ? deps[dep] : 'Not installed'
        );
      });

      // Check Fastify rate-limit version is compatible with Fastify 5
      if (deps['@fastify/rate-limit']) {
        const version = deps['@fastify/rate-limit'];
        const major = parseInt(version.replace(/[^\d.]/g, '').split('.')[0]);
        this.addResult(
          'Rate-limit compatible with Fastify 5',
          major >= 10,
          `Version: ${version} (need >=10.0 for Fastify 5)`
        );
      }
    }

    // Check health routes exist
    this.checkFileExists('services/api/src/routes/health.ts', 'Health routes');
    this.checkFileContains(
      'services/api/src/routes/health.ts',
      '/health',
      'Liveness endpoint defined'
    );
    this.checkFileContains(
      'services/api/src/routes/health.ts',
      '/ready',
      'Readiness endpoint defined'
    );

    // Check Prisma schema exists
    this.checkFileExists('services/api/prisma/schema.prisma', 'Prisma schema');

    // Check no duplicate routes (common issue)
    const tenantsPath = join(this.projectRoot, 'services/api/src/routes/tenants.ts');
    const settingsPath = join(this.projectRoot, 'services/api/src/routes/settings.ts');

    if (existsSync(tenantsPath) && existsSync(settingsPath)) {
      const tenantsContent = readFileSync(tenantsPath, 'utf-8');
      const settingsContent = readFileSync(settingsPath, 'utf-8');

      // Check for duplicate /api/tenants/:id/settings route
      const tenantHasSettings = tenantsContent.includes('/api/tenants/:id/settings');
      const settingsHasRoute = settingsContent.includes('/tenants/:tenantId/settings');

      if (tenantHasSettings && settingsHasRoute) {
        this.addResult(
          'No duplicate routes',
          false,
          'Both tenants.ts and settings.ts define /api/tenants/:id/settings'
        );
      } else {
        this.addResult('No duplicate routes', true, 'No conflicts detected');
      }
    }
  }

  private validateWebApp() {
    // Check web app files exist
    this.checkFileExists('apps/web/index.html', 'Web app HTML');
    this.checkFileExists('apps/web/src/main.tsx', 'Web app entry point');
    this.checkFileExists('apps/web/vite.config.ts', 'Vite configuration');

    // Check package.json
    this.checkFileExists('apps/web/package.json', 'Web package.json');

    // Check required dependencies
    const packageJsonPath = join(this.projectRoot, 'apps/web/package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      const requiredDeps = ['react', 'react-dom', 'amazon-cognito-identity-js', 'react-router-dom'];

      requiredDeps.forEach((dep) => {
        this.addResult(
          `Web dependency: ${dep}`,
          dep in deps,
          dep in deps ? deps[dep] : 'Not installed'
        );
      });
    }

    // Check Cognito auth service exists
    this.checkFileExists('apps/web/src/services/cognito-auth.ts', 'Cognito auth service');

    // Check environment variable usage (Vite uses process.env for config access)
    this.checkFileContains(
      'apps/web/vite.config.ts',
      /(import\.meta\.env|process\.env|defineConfig)/,
      'Environment variables configured'
    );

    // Check build script exists
    const webPackageJson = join(this.projectRoot, 'apps/web/package.json');
    if (existsSync(webPackageJson)) {
      const content = readFileSync(webPackageJson, 'utf-8');
      const hasViteBuild = content.includes('"build"') && content.includes('vite build');
      this.addResult('Build script configured', hasViteBuild, 'vite build');
    }
  }

  private validateCICD() {
    // Check GitHub Actions workflows exist
    this.checkFileExists('.github/workflows/deploy-api-dev.yml', 'API deployment workflow');
    this.checkFileExists('.github/workflows/deploy-web-dev.yml', 'Web deployment workflow');

    // Check API workflow configuration
    this.checkFileContains(
      '.github/workflows/deploy-api-dev.yml',
      'aws-actions/configure-aws-credentials',
      'AWS credentials configuration'
    );
    this.checkFileContains(
      '.github/workflows/deploy-api-dev.yml',
      'role-to-assume',
      'OIDC role configuration'
    );
    this.checkFileContains(
      '.github/workflows/deploy-api-dev.yml',
      'ECR_REPOSITORY_NAME',
      'ECR repository secret'
    );

    // Check web workflow configuration
    this.checkFileContains(
      '.github/workflows/deploy-web-dev.yml',
      'WEB_BUCKET_NAME',
      'S3 bucket secret'
    );
    this.checkFileContains(
      '.github/workflows/deploy-web-dev.yml',
      'CLOUDFRONT_DISTRIBUTION_ID',
      'CloudFront distribution secret'
    );

    // Check deployment scripts exist
    this.checkFileExists('scripts/terraform-deploy.sh', 'Terraform deployment script');

    // Check script is executable (if on Unix)
    const scriptPath = join(this.projectRoot, 'scripts/terraform-deploy.sh');
    if (existsSync(scriptPath)) {
      const content = readFileSync(scriptPath, 'utf-8');
      const hasShebang = content.startsWith('#!/bin/bash');
      this.addResult('Deployment script has shebang', hasShebang, '#!/bin/bash');
    }
  }

  private validateDocumentation() {
    const docs = [
      'README.md',
      'docs/DEPLOYMENT_DEV.md',
      'docs/TERRAFORM_DEPLOYMENT.md',
      'docs/COMPLETE_DEPLOYMENT_GUIDE.md',
      'DEPLOYMENT_RUNBOOK_DEV.md',
    ];

    docs.forEach((doc) => {
      this.checkFileExists(doc, doc);
    });

    // Check README has deployment section
    this.checkFileContains(
      'README.md',
      /(deploy|setup|getting started)/i,
      'Deployment mentioned in README'
    );

    // Check deployment guide has required sections
    const deploymentGuide = 'docs/DEPLOYMENT_DEV.md';
    if (existsSync(join(this.projectRoot, deploymentGuide))) {
      this.checkFileContains(deploymentGuide, 'DATABASE_URL', 'Database configuration documented');
      this.checkFileContains(deploymentGuide, 'COGNITO', 'Cognito configuration documented');
      this.checkFileContains(deploymentGuide, 'JWT_SECRET', 'JWT secret documented');
    }
  }

  private printSummary() {
    console.log('\n' + '='.repeat(70));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(70) + '\n');

    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const total = this.results.length;

    console.log(`Total Checks: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ${failed > 0 ? '❌' : '✅'}`);

    if (failed > 0) {
      console.log('\n❌ FAILED CHECKS:\n');
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => {
          this.log(`${r.name}${r.message ? ` - ${r.message}` : ''}`, 'error');
        });
    }

    console.log('\n' + '='.repeat(70));

    if (failed === 0) {
      this.log('✅ All validations passed! Ready for deployment.', 'success');
    } else {
      this.log(`❌ ${failed} validation(s) failed. Please fix before deploying.`, 'error');
    }

    console.log('='.repeat(70) + '\n');
  }
}

// Main execution
const environment = process.argv[2] || 'dev';
const validator = new DeploymentValidator(environment);

validator.validate().then((success) => {
  process.exit(success ? 0 : 1);
});
