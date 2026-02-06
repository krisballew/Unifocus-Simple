import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Database Seed Script
 *
 * CRITICAL: This script ensures the master admin user (kballew@unifocus.com)
 * is ALWAYS present with Platform Administrator role, even after migrations.
 *
 * The script uses upsert operations to be idempotent and safe to run multiple times.
 */

async function main() {
  console.log('🌱 Starting database seed...');

  // Ensure demo tenant exists (upsert for idempotency)
  console.log('Ensuring demo tenant exists...');
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-tenant' },
    update: {},
    create: {
      name: 'Demo Tenant',
      slug: 'demo-tenant',
    },
  });
  console.log(`✓ Tenant exists: ${tenant.name} (${tenant.id})`);

  // Create properties
  console.log('Creating properties...');
  const property1 = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: 'Hyatt Regency Times Square',
      address: '1633 Broadway',
      city: 'New York',
      state: 'NY',
      zipCode: '10019',
    },
  });
  console.log(`✓ Created property: ${property1.name}`);

  const property2 = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: 'Beverly Hills Hotel',
      address: '9641 Sunset Boulevard',
      city: 'Beverly Hills',
      state: 'CA',
      zipCode: '90210',
    },
  });
  console.log(`✓ Created property: ${property2.name}`);

  const property3 = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: 'The Fairmont Chicago',
      address: '200 North Columbus Drive',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
    },
  });
  console.log(`✓ Created property: ${property3.name}`);

  const property4 = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: 'The Plaza Hotel Miami',
      address: '168 East Flagler Street',
      city: 'Miami',
      state: 'FL',
      zipCode: '33131',
    },
  });
  console.log(`✓ Created property: ${property4.name}`);

  const property5 = await prisma.property.create({
    data: {
      tenantId: tenant.id,
      name: 'Brown Palace Hotel',
      address: '321 17th Street',
      city: 'Denver',
      state: 'CO',
      zipCode: '80202',
    },
  });
  console.log(`✓ Created property: ${property5.name}`);

  // Create master categories
  console.log('Creating master categories...');

  // Hotel Department Categories
  const departmentCategoryFrontOffice = await prisma.departmentCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Front Office',
      code: 'FO',
      description: 'Reception, concierge, and guest communications',
    },
  });
  const departmentCategoryHousekeeping = await prisma.departmentCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Housekeeping',
      code: 'HK',
      description: 'Guest rooms, laundry, and facility cleaning',
    },
  });
  const departmentCategoryFoodBeverage = await prisma.departmentCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Food & Beverage',
      code: 'FB',
      description: 'Restaurants, bars, room service, and banquets',
    },
  });
  const departmentCategoryMaintenance = await prisma.departmentCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Maintenance & Engineering',
      code: 'ME',
      description: 'Building maintenance, repairs, and operations',
    },
  });
  const departmentCategoryHR = await prisma.departmentCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Human Resources',
      code: 'HR',
      description: 'Recruitment, payroll, training, and compliance',
    },
  });
  const _departmentCategorySalesMarketing = await prisma.departmentCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Sales & Marketing',
      code: 'SM',
      description: 'Guest acquisition, events, and promotions',
    },
  });
  const _departmentCategoryFinance = await prisma.departmentCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Finance & Accounting',
      code: 'FA',
      description: 'Accounting, billing, and financial management',
    },
  });
  const departmentCategoryGuestServices = await prisma.departmentCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Guest Services',
      code: 'GS',
      description: 'Bellhop, valet, concierge, and guest relations',
    },
  });
  const departmentCategorySecurity = await prisma.departmentCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Security',
      code: 'SEC',
      description: 'Security, safety, and loss prevention',
    },
  });

  // Hotel Job Categories
  const jobCategoryFrontDesk = await prisma.jobCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Front Desk',
      code: 'FD',
      description: 'Reception and check-in roles',
    },
  });
  const jobCategoryHousekeeping = await prisma.jobCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Housekeeping',
      code: 'HK',
      description: 'Room and facility cleaning roles',
    },
  });
  const jobCategoryKitchen = await prisma.jobCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Kitchen & Culinary',
      code: 'KC',
      description: 'Chef, cook, and food preparation roles',
    },
  });
  const jobCategoryFoodService = await prisma.jobCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Food Service',
      code: 'FS',
      description: 'Server, busser, and dining service roles',
    },
  });
  const jobCategoryBeverageService = await prisma.jobCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Beverage Service',
      code: 'BS',
      description: 'Bartender and beverage service roles',
    },
  });
  const jobCategoryMaintenance = await prisma.jobCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Maintenance',
      code: 'MNT',
      description: 'Maintenance technician and engineering roles',
    },
  });
  const jobCategorySupervisory = await prisma.jobCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Supervisory',
      code: 'SUP',
      description: 'Supervisor and team lead roles',
    },
  });
  const jobCategoryManagement = await prisma.jobCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Management',
      code: 'MGT',
      description: 'Manager and director level roles',
    },
  });
  const jobCategoryGuestServices = await prisma.jobCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Guest Services',
      code: 'GS',
      description: 'Concierge, bellhop, and guest services roles',
    },
  });
  const jobCategorySecurity = await prisma.jobCategory.create({
    data: {
      tenantId: tenant.id,
      name: 'Security',
      code: 'SEC',
      description: 'Security and loss prevention roles',
    },
  });

  // Create divisions
  console.log('Creating divisions...');
  const divisionOps1 = await prisma.division.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      name: 'Operations',
      code: 'OPS',
    },
  });
  const divisionOps2 = await prisma.division.create({
    data: {
      tenantId: tenant.id,
      propertyId: property2.id,
      name: 'Operations',
      code: 'OPS',
    },
  });
  const divisionSupplyChain = await prisma.division.create({
    data: {
      tenantId: tenant.id,
      propertyId: property3.id,
      name: 'Supply Chain',
      code: 'SCM',
    },
  });
  const divisionDistribution = await prisma.division.create({
    data: {
      tenantId: tenant.id,
      propertyId: property4.id,
      name: 'Distribution',
      code: 'DST',
    },
  });
  const divisionRetail = await prisma.division.create({
    data: {
      tenantId: tenant.id,
      propertyId: property5.id,
      name: 'Retail',
      code: 'RTL',
    },
  });

  // Create departments
  console.log('Creating departments...');

  // Property 1 (Hyatt Regency Times Square) - Front Office
  const deptFrontOffice = await prisma.department.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      divisionId: divisionOps1.id,
      departmentCategoryId: departmentCategoryFrontOffice.id,
      name: 'Front Office',
      code: 'FO',
      costCenter: 'CC-1001',
      laborBudget: 150000,
      location: 'Building A - Ground Floor',
      reportingGroupId: 'RG-OPERATIONS',
    },
  });
  console.log(`✓ Created department: ${deptFrontOffice.name}`);

  // Property 1 - Housekeeping
  const deptHousekeeping = await prisma.department.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      divisionId: divisionOps1.id,
      departmentCategoryId: departmentCategoryHousekeeping.id,
      name: 'Housekeeping',
      code: 'HK',
      costCenter: 'CC-1002',
      laborBudget: 200000,
      location: 'Building A - Basement',
      reportingGroupId: 'RG-OPERATIONS',
    },
  });
  console.log(`✓ Created department: ${deptHousekeeping.name}`);

  // Property 2 (Beverly Hills Hotel) - Food & Beverage
  const deptFoodBeverage = await prisma.department.create({
    data: {
      tenantId: tenant.id,
      propertyId: property2.id,
      divisionId: divisionOps2.id,
      departmentCategoryId: departmentCategoryFoodBeverage.id,
      name: 'Food & Beverage',
      code: 'FB',
      costCenter: 'CC-2001',
      laborBudget: 350000,
      location: 'Building B - Kitchen & Dining',
      reportingGroupId: 'RG-OPERATIONS',
    },
  });
  console.log(`✓ Created department: ${deptFoodBeverage.name}`);

  // Property 2 - Guest Services
  const deptGuestServices = await prisma.department.create({
    data: {
      tenantId: tenant.id,
      propertyId: property2.id,
      divisionId: divisionOps2.id,
      departmentCategoryId: departmentCategoryGuestServices.id,
      name: 'Guest Services',
      code: 'GS',
      costCenter: 'CC-2002',
      laborBudget: 125000,
      location: 'Building B - Lobby & Bellhop',
      reportingGroupId: 'RG-OPERATIONS',
    },
  });
  console.log(`✓ Created department: ${deptGuestServices.name}`);

  // Property 3 (Fairmont Chicago) - Maintenance & Engineering
  const deptMaintenance = await prisma.department.create({
    data: {
      tenantId: tenant.id,
      propertyId: property3.id,
      divisionId: divisionSupplyChain.id,
      departmentCategoryId: departmentCategoryMaintenance.id,
      name: 'Maintenance & Engineering',
      code: 'ME',
      costCenter: 'CC-3001',
      laborBudget: 180000,
      location: 'Building C - Mechanical Room',
      reportingGroupId: 'RG-FACILITIES',
    },
  });
  console.log(`✓ Created department: ${deptMaintenance.name}`);

  // Property 4 (Plaza Hotel Miami) - Security
  const deptSecurity = await prisma.department.create({
    data: {
      tenantId: tenant.id,
      propertyId: property4.id,
      divisionId: divisionDistribution.id,
      departmentCategoryId: departmentCategorySecurity.id,
      name: 'Security',
      code: 'SEC',
      costCenter: 'CC-4001',
      laborBudget: 140000,
      location: 'Building D - Security Office',
      reportingGroupId: 'RG-FACILITIES',
    },
  });
  console.log(`✓ Created department: ${deptSecurity.name}`);

  // Property 5 (Brown Palace) - Human Resources
  const deptHR = await prisma.department.create({
    data: {
      tenantId: tenant.id,
      propertyId: property5.id,
      divisionId: divisionRetail.id,
      departmentCategoryId: departmentCategoryHR.id,
      name: 'Human Resources',
      code: 'HR',
      costCenter: 'CC-5001',
      laborBudget: 100000,
      location: 'Building E - Human Resources',
      reportingGroupId: 'RG-CORPORATE',
    },
  });
  console.log(`✓ Created department: ${deptHR.name}`);

  // Create job roles
  console.log('Creating job roles...');

  // Front Office job roles
  const jobRoleFrontDeskAgent = await prisma.jobRole.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      departmentId: deptFrontOffice.id,
      jobCategoryId: jobCategoryFrontDesk.id,
      name: 'Front Desk Agent',
      code: 'FDA',
      payCode: 'PC-1010',
      skillClassification: 'Entry Level',
      flsaStatus: 'NON_EXEMPT',
      unionClassification: 'Non-Union',
      certificationRequirements: ['Customer Service Certification'],
      isActive: true,
    },
  });
  console.log(`✓ Created job role: ${jobRoleFrontDeskAgent.name}`);

  const jobRoleNightAuditor = await prisma.jobRole.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      departmentId: deptFrontOffice.id,
      jobCategoryId: jobCategoryFrontDesk.id,
      name: 'Night Auditor',
      code: 'NA',
      payCode: 'PC-1011',
      skillClassification: 'Intermediate',
      flsaStatus: 'NON_EXEMPT',
      unionClassification: 'Non-Union',
      certificationRequirements: ['Night Operations', 'PMS System'],
      isActive: true,
    },
  });
  console.log(`✓ Created job role: ${jobRoleNightAuditor.name}`);

  // Housekeeping job roles
  const jobRoleHousekeepingAttendant = await prisma.jobRole.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      departmentId: deptHousekeeping.id,
      jobCategoryId: jobCategoryHousekeeping.id,
      name: 'Housekeeping Attendant',
      code: 'HA',
      payCode: 'PC-2010',
      skillClassification: 'Entry Level',
      flsaStatus: 'NON_EXEMPT',
      unionClassification: 'UNITE HERE',
      certificationRequirements: ['Safety Training', 'Chemical Handling'],
      isActive: true,
    },
  });
  console.log(`✓ Created job role: ${jobRoleHousekeepingAttendant.name}`);

  const jobRoleHousekeepingSupervisor = await prisma.jobRole.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      departmentId: deptHousekeeping.id,
      jobCategoryId: jobCategorySupervisory.id,
      name: 'Housekeeping Supervisor',
      code: 'HS',
      payCode: 'PC-2020',
      skillClassification: 'Advanced',
      flsaStatus: 'SALARIED',
      unionClassification: 'UNITE HERE',
      certificationRequirements: ['Leadership Training', 'Supervisory Skills'],
      isActive: true,
    },
  });
  console.log(`✓ Created job role: ${jobRoleHousekeepingSupervisor.name}`);

  // Food & Beverage job roles
  const jobRoleChef = await prisma.jobRole.create({
    data: {
      tenantId: tenant.id,
      propertyId: property2.id,
      departmentId: deptFoodBeverage.id,
      jobCategoryId: jobCategoryKitchen.id,
      name: 'Executive Chef',
      code: 'EC',
      payCode: 'PC-3010',
      skillClassification: 'Advanced',
      flsaStatus: 'SALARIED',
      unionClassification: 'ACF (American Culinary Federation)',
      certificationRequirements: ['Food Handler', 'ServSafe', 'HACCP Certification'],
      isActive: true,
    },
  });
  console.log(`✓ Created job role: ${jobRoleChef.name}`);

  const jobRoleServer = await prisma.jobRole.create({
    data: {
      tenantId: tenant.id,
      propertyId: property2.id,
      departmentId: deptFoodBeverage.id,
      jobCategoryId: jobCategoryFoodService.id,
      name: 'Server',
      code: 'SRV',
      payCode: 'PC-3020',
      skillClassification: 'Entry Level',
      flsaStatus: 'NON_EXEMPT',
      unionClassification: 'UNITE HERE',
      certificationRequirements: ['Food Handler', 'Alcohol Service'],
      isActive: true,
    },
  });
  console.log(`✓ Created job role: ${jobRoleServer.name}`);

  const jobRoleBartender = await prisma.jobRole.create({
    data: {
      tenantId: tenant.id,
      propertyId: property2.id,
      departmentId: deptFoodBeverage.id,
      jobCategoryId: jobCategoryBeverageService.id,
      name: 'Bartender',
      code: 'BAR',
      payCode: 'PC-3025',
      skillClassification: 'Intermediate',
      flsaStatus: 'NON_EXEMPT',
      unionClassification: 'UNITE HERE',
      certificationRequirements: ['Mixology', 'Alcohol Certification', 'Food Handler'],
      isActive: true,
    },
  });
  console.log(`✓ Created job role: ${jobRoleBartender.name}`);

  // Guest Services job roles
  const jobRoleConcierge = await prisma.jobRole.create({
    data: {
      tenantId: tenant.id,
      propertyId: property2.id,
      departmentId: deptGuestServices.id,
      jobCategoryId: jobCategoryGuestServices.id,
      name: 'Concierge',
      code: 'CON',
      payCode: 'PC-4010',
      skillClassification: 'Intermediate',
      flsaStatus: 'NON_EXEMPT',
      unionClassification: 'Non-Union',
      certificationRequirements: ['Guest Relations', 'City Knowledge'],
      isActive: true,
    },
  });
  console.log(`✓ Created job role: ${jobRoleConcierge.name}`);

  const jobRoleBellhop = await prisma.jobRole.create({
    data: {
      tenantId: tenant.id,
      propertyId: property2.id,
      departmentId: deptGuestServices.id,
      jobCategoryId: jobCategoryGuestServices.id,
      name: 'Bellhop',
      code: 'BH',
      payCode: 'PC-4020',
      skillClassification: 'Entry Level',
      flsaStatus: 'NON_EXEMPT',
      unionClassification: 'Non-Union',
      certificationRequirements: ['Customer Service', 'Safety Training'],
      isActive: true,
    },
  });
  console.log(`✓ Created job role: ${jobRoleBellhop.name}`);

  // Maintenance & Engineering job roles
  const jobRoleMaintenanceTech = await prisma.jobRole.create({
    data: {
      tenantId: tenant.id,
      propertyId: property3.id,
      departmentId: deptMaintenance.id,
      jobCategoryId: jobCategoryMaintenance.id,
      name: 'Maintenance Technician',
      code: 'MT',
      payCode: 'PC-5010',
      skillClassification: 'Intermediate',
      flsaStatus: 'HOURLY',
      unionClassification: 'International Union of Operating Engineers',
      certificationRequirements: ['HVAC Certification', 'Electrical License', 'Plumbing'],
      isActive: true,
    },
  });
  console.log(`✓ Created job role: ${jobRoleMaintenanceTech.name}`);

  const jobRoleEngineer = await prisma.jobRole.create({
    data: {
      tenantId: tenant.id,
      propertyId: property3.id,
      departmentId: deptMaintenance.id,
      jobCategoryId: jobCategoryMaintenance.id,
      name: 'Chief Engineer',
      code: 'CE',
      payCode: 'PC-5030',
      skillClassification: 'Advanced',
      flsaStatus: 'SALARIED',
      unionClassification: 'International Union of Operating Engineers',
      certificationRequirements: ['Engineering Degree', 'HVAC', 'Electrical', 'Plumbing'],
      isActive: true,
    },
  });
  console.log(`✓ Created job role: ${jobRoleEngineer.name}`);

  // Security job roles
  const jobRoleSecurityOfficer = await prisma.jobRole.create({
    data: {
      tenantId: tenant.id,
      propertyId: property4.id,
      departmentId: deptSecurity.id,
      jobCategoryId: jobCategorySecurity.id,
      name: 'Security Officer',
      code: 'SO',
      payCode: 'PC-6010',
      skillClassification: 'Intermediate',
      flsaStatus: 'NON_EXEMPT',
      unionClassification: 'Allied Security Services',
      certificationRequirements: ['Security License', 'First Aid', 'Crisis Management'],
      isActive: true,
    },
  });
  console.log(`✓ Created job role: ${jobRoleSecurityOfficer.name}`);

  const jobRoleSecuritySupervisor = await prisma.jobRole.create({
    data: {
      tenantId: tenant.id,
      propertyId: property4.id,
      departmentId: deptSecurity.id,
      jobCategoryId: jobCategorySecurity.id,
      name: 'Security Supervisor',
      code: 'SS',
      payCode: 'PC-6020',
      skillClassification: 'Advanced',
      flsaStatus: 'SALARIED',
      unionClassification: 'Allied Security Services',
      certificationRequirements: ['Security License', 'Leadership Training', 'Emergency Response'],
      isActive: true,
    },
  });
  console.log(`✓ Created job role: ${jobRoleSecuritySupervisor.name}`);

  // HR job roles (management level)
  const jobRoleHRManager = await prisma.jobRole.create({
    data: {
      tenantId: tenant.id,
      propertyId: property5.id,
      departmentId: deptHR.id,
      jobCategoryId: jobCategoryManagement.id,
      name: 'HR Manager',
      code: 'HRM',
      payCode: 'PC-7010',
      skillClassification: 'Advanced',
      flsaStatus: 'SALARIED',
      unionClassification: 'Non-Union',
      certificationRequirements: ['HR Certification (SHRM)', 'Legal Compliance Training'],
      isActive: true,
    },
  });
  console.log(`✓ Created job role: ${jobRoleHRManager.name}`);

  await prisma.jobAssignment.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      jobRoleId: jobRoleFrontDeskAgent.id,
      name: 'Day Shift Agent',
      code: 'DSA',
      description: 'Front desk coverage during day shift.',
    },
  });

  await prisma.jobAssignment.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      jobRoleId: jobRoleHousekeepingAttendant.id,
      name: 'Room Cleaning Attendant',
      code: 'RCA',
      description: 'Responsible for daily guest room cleaning and maintenance.',
    },
  });

  await prisma.jobAssignment.create({
    data: {
      tenantId: tenant.id,
      propertyId: property2.id,
      jobRoleId: jobRoleServer.id,
      name: 'Fine Dining Server',
      code: 'FDS',
      description: 'Server specializing in fine dining experience.',
    },
  });

  await prisma.jobAssignment.create({
    data: {
      tenantId: tenant.id,
      propertyId: property2.id,
      jobRoleId: jobRoleBellhop.id,
      name: 'Guest Transport Specialist',
      code: 'GTS',
      description: 'Handle guest luggage and transportation services.',
    },
  });

  await prisma.jobAssignment.create({
    data: {
      tenantId: tenant.id,
      propertyId: property3.id,
      jobRoleId: jobRoleMaintenanceTech.id,
      name: 'HVAC Technician',
      code: 'HVA',
      description: 'Maintain and repair HVAC systems throughout the property.',
    },
  });

  await prisma.jobAssignment.create({
    data: {
      tenantId: tenant.id,
      propertyId: property4.id,
      jobRoleId: jobRoleSecurityOfficer.id,
      name: 'Night Shift Security',
      code: 'NSS',
      description: 'Provide security coverage during night hours.',
    },
  });

  // Create roles
  console.log('Creating roles...');
  const platformAdminRole = await prisma.role.upsert({
    where: { name: 'Platform Administrator' },
    update: {
      description: 'Full system access across all tenants',
      permissions: ['*'],
    },
    create: {
      name: 'Platform Administrator',
      description: 'Full system access across all tenants',
      permissions: ['*'],
    },
  });
  console.log(`✓ Role exists: ${platformAdminRole.name}`);

  const propertyAdminRole = await prisma.role.create({
    data: {
      name: 'Property Administrator',
      description: 'Full property-level configuration and operations',
      permissions: [
        'read:*',
        'write:*',
        'delete:*',
        'manage:property',
        'manage:departments',
        'manage:schedules',
        'approve:timecards',
      ],
    },
  });
  console.log(`✓ Created role: ${propertyAdminRole.name}`);

  const hrManagerRole = await prisma.role.create({
    data: {
      name: 'HR Manager',
      description: 'Manage employee lifecycle and compliance',
      permissions: [
        'read:employees',
        'write:employees',
        'delete:employees',
        'manage:onboarding',
        'manage:certifications',
        'manage:documents',
        'read:compliance',
        'write:compliance',
      ],
    },
  });
  console.log(`✓ Created role: ${hrManagerRole.name}`);

  const departmentManagerRole = await prisma.role.create({
    data: {
      name: 'Department Manager',
      description: 'Manage department schedules and timecards',
      permissions: [
        'read:employees',
        'read:schedules',
        'write:schedules',
        'read:punches',
        'approve:timecards',
        'read:exceptions',
        'write:exceptions',
        'approve:pto',
      ],
    },
  });
  console.log(`✓ Created role: ${departmentManagerRole.name}`);

  const employeeRole = await prisma.role.create({
    data: {
      name: 'Employee',
      description: 'Basic employee self-service access',
      permissions: ['read:own_punches', 'write:own_punches', 'read:own_schedule', 'request:pto'],
    },
  });
  console.log(`✓ Created role: ${employeeRole.name}`);

  // Ensure master admin user exists (CRITICAL: Always maintain this user)
  console.log('Ensuring master admin user exists...');
  const hashedPassword = await bcryptjs.hash('password123', 10);
  const masterAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'kballew@unifocus.com',
      },
    },
    update: {
      name: 'Kris Ballew',
      password: hashedPassword,
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      email: 'kballew@unifocus.com',
      name: 'Kris Ballew',
      password: hashedPassword,
      isActive: true,
    },
  });
  console.log(`✓ Master admin user exists: ${masterAdmin.email} (password: password123)`);

  // Ensure Platform Administrator role assignment
  const existingRoleAssignment = await prisma.userRoleAssignment.findFirst({
    where: {
      userId: masterAdmin.id,
      roleId: platformAdminRole.id,
    },
  });

  if (!existingRoleAssignment) {
    await prisma.userRoleAssignment.create({
      data: {
        tenantId: tenant.id,
        userId: masterAdmin.id,
        roleId: platformAdminRole.id,
        isActive: true,
      },
    });
    console.log(`✓ Assigned Platform Administrator role to ${masterAdmin.email}`);
  } else {
    // Update to ensure it's active
    await prisma.userRoleAssignment.update({
      where: { id: existingRoleAssignment.id },
      data: { isActive: true },
    });
    console.log(`✓ Platform Administrator role already assigned to ${masterAdmin.email}`);
  }

  type SeedJobInput = {
    jobRole: { id: string; name: string; code?: string | null };
    department: { id: string; name: string; location?: string | null };
    payType: 'hourly' | 'salary';
    rate: string;
    jobStatus: 'active' | 'inactive' | 'on-leave';
    payGroup: string;
    isPrimary: boolean;
    subOnly?: boolean;
    annualAmount?: string;
    hours?: string;
    notes?: string;
  };

  const buildJobRecord = (job: SeedJobInput, startDate: string) => ({
    jobRoleId: job.jobRole.id,
    departmentId: job.department.id,
    jobCode: job.jobRole.code ?? '',
    jobTitle: job.jobRole.name,
    department: job.department.name,
    location: job.department.location ?? '',
    payType: job.payType,
    rate: job.rate,
    jobDate: startDate,
    jobStatus: job.jobStatus,
    payGroup: job.payGroup,
    isPrimary: job.isPrimary,
    subOnly: job.subOnly ?? false,
    annualAmount: job.annualAmount,
    hours: job.hours,
    notes: job.notes,
  });

  const buildEmploymentDetails = (startDate: string, jobs: SeedJobInput[]) => ({
    jobCompensationRecords: [
      {
        effectiveStartDate: startDate,
        effectiveEndDate: 'Present',
        jobs: jobs.map((job) => buildJobRecord(job, startDate)),
      },
    ],
    selectedEffectiveRangeIndex: 0,
  });

  // Create employees
  console.log('Creating employees...');
  const employee1 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      employeeId: 'EMP1001',
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice.johnson@demo.unifocus.com',
      phone: '555-0101',
      hireDate: new Date('2023-01-15'),
      isActive: true,
      employmentDetails: buildEmploymentDetails('2023-01-15', [
        {
          jobRole: jobRoleFrontDeskAgent,
          department: deptFrontOffice,
          payType: 'hourly',
          rate: '18.50',
          jobStatus: 'active',
          payGroup: 'Weekly',
          isPrimary: true,
          annualAmount: '38480',
          hours: '40',
        },
        {
          jobRole: jobRoleNightAuditor,
          department: deptFrontOffice,
          payType: 'hourly',
          rate: '20.50',
          jobStatus: 'active',
          payGroup: 'Weekly',
          isPrimary: false,
          subOnly: true,
          annualAmount: '42640',
          hours: '16',
        },
      ]),
    },
  });
  console.log(`✓ Created employee: ${employee1.firstName} ${employee1.lastName}`);

  const employee2 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      employeeId: 'EMP1002',
      firstName: 'Bob',
      lastName: 'Smith',
      email: 'bob.smith@demo.unifocus.com',
      phone: '555-0102',
      hireDate: new Date('2023-03-20'),
      isActive: true,
      employmentDetails: buildEmploymentDetails('2023-03-20', [
        {
          jobRole: jobRoleHousekeepingAttendant,
          department: deptHousekeeping,
          payType: 'hourly',
          rate: '17.00',
          jobStatus: 'active',
          payGroup: 'Weekly',
          isPrimary: true,
          annualAmount: '35360',
          hours: '40',
        },
      ]),
    },
  });
  console.log(`✓ Created employee: ${employee2.firstName} ${employee2.lastName}`);

  const employee3 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property2.id,
      employeeId: 'EMP2001',
      firstName: 'Carol',
      lastName: 'White',
      email: 'carol.white@demo.unifocus.com',
      phone: '555-0103',
      hireDate: new Date('2023-06-01'),
      isActive: true,
      employmentDetails: buildEmploymentDetails('2023-06-01', [
        {
          jobRole: jobRoleChef,
          department: deptFoodBeverage,
          payType: 'salary',
          rate: '78000',
          jobStatus: 'active',
          payGroup: 'Biweekly',
          isPrimary: true,
          annualAmount: '78000',
          hours: '40',
        },
        {
          jobRole: jobRoleServer,
          department: deptFoodBeverage,
          payType: 'hourly',
          rate: '16.50',
          jobStatus: 'active',
          payGroup: 'Weekly',
          isPrimary: false,
          subOnly: true,
          annualAmount: '34320',
          hours: '12',
        },
      ]),
    },
  });
  console.log(`✓ Created employee: ${employee3.firstName} ${employee3.lastName}`);

  const employee4 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property3.id,
      employeeId: 'EMP3001',
      firstName: 'David',
      lastName: 'Martinez',
      email: 'david.martinez@demo.unifocus.com',
      phone: '555-0104',
      hireDate: new Date('2022-11-10'),
      isActive: true,
      employmentDetails: buildEmploymentDetails('2022-11-10', [
        {
          jobRole: jobRoleEngineer,
          department: deptMaintenance,
          payType: 'salary',
          rate: '90000',
          jobStatus: 'active',
          payGroup: 'Biweekly',
          isPrimary: true,
          annualAmount: '90000',
          hours: '40',
        },
      ]),
    },
  });
  console.log(`✓ Created employee: ${employee4.firstName} ${employee4.lastName}`);

  const employee5 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property3.id,
      employeeId: 'EMP3002',
      firstName: 'Emma',
      lastName: 'Davis',
      email: 'emma.davis@demo.unifocus.com',
      phone: '555-0105',
      hireDate: new Date('2024-01-05'),
      isActive: true,
      employmentDetails: buildEmploymentDetails('2024-01-05', [
        {
          jobRole: jobRoleMaintenanceTech,
          department: deptMaintenance,
          payType: 'hourly',
          rate: '24.50',
          jobStatus: 'active',
          payGroup: 'Weekly',
          isPrimary: true,
          annualAmount: '50960',
          hours: '40',
        },
      ]),
    },
  });
  console.log(`✓ Created employee: ${employee5.firstName} ${employee5.lastName}`);

  const employee6 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property4.id,
      employeeId: 'EMP4001',
      firstName: 'Frank',
      lastName: 'Wilson',
      email: 'frank.wilson@demo.unifocus.com',
      phone: '555-0106',
      hireDate: new Date('2023-08-15'),
      isActive: true,
      employmentDetails: buildEmploymentDetails('2023-08-15', [
        {
          jobRole: jobRoleSecurityOfficer,
          department: deptSecurity,
          payType: 'hourly',
          rate: '22.00',
          jobStatus: 'active',
          payGroup: 'Weekly',
          isPrimary: true,
          annualAmount: '45760',
          hours: '40',
        },
      ]),
    },
  });
  console.log(`✓ Created employee: ${employee6.firstName} ${employee6.lastName}`);

  const employee7 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property4.id,
      employeeId: 'EMP4002',
      firstName: 'Grace',
      lastName: 'Taylor',
      email: 'grace.taylor@demo.unifocus.com',
      phone: '555-0107',
      hireDate: new Date('2023-09-20'),
      isActive: true,
      employmentDetails: buildEmploymentDetails('2023-09-20', [
        {
          jobRole: jobRoleSecuritySupervisor,
          department: deptSecurity,
          payType: 'salary',
          rate: '65000',
          jobStatus: 'active',
          payGroup: 'Biweekly',
          isPrimary: true,
          annualAmount: '65000',
          hours: '40',
        },
        {
          jobRole: jobRoleSecurityOfficer,
          department: deptSecurity,
          payType: 'hourly',
          rate: '21.00',
          jobStatus: 'on-leave',
          payGroup: 'Weekly',
          isPrimary: false,
          subOnly: true,
          annualAmount: '43680',
          hours: '12',
        },
      ]),
    },
  });
  console.log(`✓ Created employee: ${employee7.firstName} ${employee7.lastName}`);

  const employee8 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property5.id,
      employeeId: 'EMP5001',
      firstName: 'Henry',
      lastName: 'Anderson',
      email: 'henry.anderson@demo.unifocus.com',
      phone: '555-0108',
      hireDate: new Date('2024-02-01'),
      isActive: true,
      employmentDetails: buildEmploymentDetails('2024-02-01', [
        {
          jobRole: jobRoleHRManager,
          department: deptHR,
          payType: 'salary',
          rate: '72000',
          jobStatus: 'active',
          payGroup: 'Biweekly',
          isPrimary: true,
          annualAmount: '72000',
          hours: '40',
        },
      ]),
    },
  });
  console.log(`✓ Created employee: ${employee8.firstName} ${employee8.lastName}`);

  const employee9 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property5.id,
      employeeId: 'EMP5002',
      firstName: 'Isabel',
      lastName: 'Thomas',
      email: 'isabel.thomas@demo.unifocus.com',
      phone: '555-0109',
      hireDate: new Date('2023-07-10'),
      isActive: true,
      employmentDetails: buildEmploymentDetails('2023-07-10', [
        {
          jobRole: jobRoleHRManager,
          department: deptHR,
          payType: 'salary',
          rate: '68000',
          jobStatus: 'active',
          payGroup: 'Monthly',
          isPrimary: true,
          annualAmount: '68000',
          hours: '40',
        },
      ]),
    },
  });
  console.log(`✓ Created employee: ${employee9.firstName} ${employee9.lastName}`);

  const employee10 = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      employeeId: 'EMP1003',
      firstName: 'Jack',
      lastName: 'Moore',
      email: 'jack.moore@demo.unifocus.com',
      phone: '555-0110',
      hireDate: new Date('2023-04-12'),
      isActive: true,
      employmentDetails: buildEmploymentDetails('2023-04-12', [
        {
          jobRole: jobRoleNightAuditor,
          department: deptFrontOffice,
          payType: 'hourly',
          rate: '19.25',
          jobStatus: 'active',
          payGroup: 'Weekly',
          isPrimary: true,
          annualAmount: '40040',
          hours: '40',
        },
      ]),
    },
  });
  console.log(`✓ Created employee: ${employee10.firstName} ${employee10.lastName}`);

  // Create employee job assignments
  console.log('Creating employee job assignments...');
  await prisma.employeeJobAssignment.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee1.id,
      jobRoleId: jobRoleFrontDeskAgent.id,
      payType: 'hourly',
      hourlyRate: 18.0,
      startDate: new Date('2023-01-15'),
      isPrimary: true,
      isActive: true,
    },
  });
  console.log('✓ Assigned job to Alice Johnson');

  await prisma.employeeJobAssignment.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee2.id,
      jobRoleId: jobRoleHousekeepingAttendant.id,
      payType: 'hourly',
      hourlyRate: 16.0,
      startDate: new Date('2023-03-20'),
      isPrimary: true,
      isActive: true,
    },
  });
  console.log('✓ Assigned job to Bob Smith');

  await prisma.employeeJobAssignment.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee3.id,
      jobRoleId: jobRoleServer.id,
      payType: 'hourly',
      hourlyRate: 15.0,
      startDate: new Date('2023-06-01'),
      isPrimary: true,
      isActive: true,
    },
  });
  console.log('✓ Assigned job to Carol White');

  await prisma.employeeJobAssignment.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee4.id,
      jobRoleId: jobRoleChef.id,
      payType: 'salary',
      salaryAmount: 55000.0,
      startDate: new Date('2022-11-10'),
      isPrimary: true,
      isActive: true,
    },
  });
  console.log('✓ Assigned job to David Martinez');

  await prisma.employeeJobAssignment.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee5.id,
      jobRoleId: jobRoleBartender.id,
      payType: 'hourly',
      hourlyRate: 16.0,
      startDate: new Date('2024-01-05'),
      isPrimary: true,
      isActive: true,
    },
  });
  console.log('✓ Assigned job to Emma Davis');

  await prisma.employeeJobAssignment.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee6.id,
      jobRoleId: jobRoleMaintenanceTech.id,
      payType: 'salary',
      salaryAmount: 48000.0,
      startDate: new Date('2023-08-15'),
      isPrimary: true,
      isActive: true,
    },
  });
  console.log('✓ Assigned job to Frank Wilson');

  // Create schedules
  console.log('Creating schedules...');
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const schedule1 = await prisma.schedule.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      employeeId: employee1.id,
      name: 'Weekly Schedule - Alice',
      startDate: today,
      endDate: nextWeek,
      isActive: true,
    },
  });
  console.log('✓ Created schedule for Alice');

  const schedule2 = await prisma.schedule.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      employeeId: employee2.id,
      name: 'Weekly Schedule - Bob',
      startDate: today,
      endDate: nextWeek,
      isActive: true,
    },
  });
  console.log('✓ Created schedule for Bob');

  // Create shifts
  console.log('Creating shifts...');
  // Monday - Friday 9am - 5pm for Alice
  for (let day = 1; day <= 5; day++) {
    await prisma.shift.create({
      data: {
        tenantId: tenant.id,
        scheduleId: schedule1.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '17:00',
        breakMinutes: 60,
      },
    });
  }
  console.log('✓ Created shifts for Alice (Mon-Fri 9am-5pm)');

  // Monday - Friday 8am - 4pm for Bob
  for (let day = 1; day <= 5; day++) {
    await prisma.shift.create({
      data: {
        tenantId: tenant.id,
        scheduleId: schedule2.id,
        dayOfWeek: day,
        startTime: '08:00',
        endTime: '16:00',
        breakMinutes: 30,
      },
    });
  }
  console.log('✓ Created shifts for Bob (Mon-Fri 8am-4pm)');

  // Create some sample punches
  console.log('Creating sample punches...');

  // Create punches for the past 7 days for multiple employees
  const daysAgo7 = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Alice - Full week with breaks
  for (let d = 0; d < 5; d++) {
    const punchDate = new Date(daysAgo7.getTime() + d * 24 * 60 * 60 * 1000);

    const clockIn = new Date(punchDate);
    clockIn.setHours(9, 0, 0);

    const breakStart = new Date(punchDate);
    breakStart.setHours(12, 30, 0);

    const breakEnd = new Date(punchDate);
    breakEnd.setHours(13, 0, 0);

    const clockOut = new Date(punchDate);
    clockOut.setHours(17, 0, 0);

    await prisma.punch.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee1.id,
        type: 'in',
        timestamp: clockIn,
        deviceId: 'device-001',
      },
    });

    await prisma.punch.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee1.id,
        type: 'break_start',
        timestamp: breakStart,
        deviceId: 'device-001',
      },
    });

    await prisma.punch.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee1.id,
        type: 'break_end',
        timestamp: breakEnd,
        deviceId: 'device-001',
      },
    });

    await prisma.punch.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee1.id,
        type: 'out',
        timestamp: clockOut,
        deviceId: 'device-001',
      },
    });
  }
  console.log('✓ Created 5 days of punches for Alice');

  // Bob - Regular schedule
  for (let d = 0; d < 5; d++) {
    const punchDate = new Date(daysAgo7.getTime() + d * 24 * 60 * 60 * 1000);

    const clockIn = new Date(punchDate);
    clockIn.setHours(8, 0, 0);

    const clockOut = new Date(punchDate);
    clockOut.setHours(16, 0, 0);

    await prisma.punch.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee2.id,
        type: 'in',
        timestamp: clockIn,
        deviceId: 'device-002',
      },
    });

    await prisma.punch.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee2.id,
        type: 'out',
        timestamp: clockOut,
        deviceId: 'device-002',
      },
    });
  }
  console.log('✓ Created 5 days of punches for Bob');

  // David - Warehouse shifts (earlier start)
  for (let d = 0; d < 5; d++) {
    const punchDate = new Date(daysAgo7.getTime() + d * 24 * 60 * 60 * 1000);

    const clockIn = new Date(punchDate);
    clockIn.setHours(6, 0, 0);

    const clockOut = new Date(punchDate);
    clockOut.setHours(14, 30, 0);

    await prisma.punch.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee4.id,
        type: 'in',
        timestamp: clockIn,
        deviceId: 'device-003',
      },
    });

    await prisma.punch.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee4.id,
        type: 'out',
        timestamp: clockOut,
        deviceId: 'device-003',
      },
    });
  }
  console.log('✓ Created 5 days of punches for David');

  // Today's punches for multiple employees
  const todayClockIn1 = new Date(today);
  todayClockIn1.setHours(9, 5, 0); // Alice slightly late

  const todayClockIn2 = new Date(today);
  todayClockIn2.setHours(7, 55, 0); // Bob early

  const todayClockIn3 = new Date(today);
  todayClockIn3.setHours(10, 0, 0); // Henry on time

  await prisma.punch.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee1.id,
      type: 'in',
      timestamp: todayClockIn1,
      deviceId: 'device-001',
    },
  });

  await prisma.punch.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee2.id,
      type: 'in',
      timestamp: todayClockIn2,
      deviceId: 'device-002',
    },
  });

  await prisma.punch.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee8.id,
      type: 'in',
      timestamp: todayClockIn3,
      deviceId: 'device-005',
    },
  });
  console.log("✓ Created today's punches");

  // Create a sample exception
  console.log('Creating sample exceptions...');
  await prisma.exception.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee2.id,
      type: 'absence',
      reason: 'Sick leave',
      date: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
      status: 'pending',
    },
  });
  console.log('✓ Created sample exception for Bob');

  console.log('✅ Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
