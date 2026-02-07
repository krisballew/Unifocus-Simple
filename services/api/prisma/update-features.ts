#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const allFeatures = {
  scheduling_v2: true,
  time_clock: true,
  timecard: true,
  exceptions_queue: true,
  hr_management: true,
  org_structure: true,
  user_administration: true,
  properties_management: true,
  advanced_reporting: true,
  mobile_access: true,
  labor_compliance: true,
  shift_swaps: true,
  availability_management: true,
  schedule_templates: true,
  auto_scheduling: true,
};

async function updateFeatures() {
  const result = await prisma.property.updateMany({
    where: { tenant: { slug: 'demo-tenant' } },
    data: { features: allFeatures },
  });

  console.log(`✅ Updated ${result.count} properties with all feature flags enabled`);

  // List all properties with their features
  const properties = await prisma.property.findMany({
    where: { tenant: { slug: 'demo-tenant' } },
    select: { name: true, features: true },
  });

  console.log('\n📋 Properties with feature flags:');
  properties.forEach((prop) => {
    console.log(`   • ${prop.name}`);
    console.log(`     Features: ${Object.keys(prop.features as object).length} flags enabled`);
  });
}

updateFeatures()
  .catch((error) => {
    console.error('❌ Error updating features:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
