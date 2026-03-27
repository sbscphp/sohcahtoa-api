import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BranchData {
  name: string;
  state: string;
  address: string;
  branchManager: string;
  email: string;
  phoneNumber: string;
  isActive: boolean;
  status: 'APPROVED';
}

const pickupLocations: BranchData[] = [
  // Lagos State
  {
    name: 'Sohcahtoa Lagos Island',
    state: 'Lagos',
    address: '45 Marina Street, Lagos Island, Lagos',
    branchManager: 'Adewale Johnson',
    email: 'lagos.island@sohcahtoa.com',
    phoneNumber: '+234 803 123 4567',
    isActive: true,
    status: 'APPROVED',
  },
  {
    name: 'Sohcahtoa Ikeja',
    state: 'Lagos',
    address: '12 Obafemi Awolowo Way, Ikeja, Lagos',
    branchManager: 'Chinyere Okonkwo',
    email: 'ikeja@sohcahtoa.com',
    phoneNumber: '+234 803 234 5678',
    isActive: true,
    status: 'APPROVED',
  },
  {
    name: 'Sohcahtoa Victoria Island',
    state: 'Lagos',
    address: '28 Ahmadu Bello Way, Victoria Island, Lagos',
    branchManager: 'Oluwaseun Ademola',
    email: 'vi@sohcahtoa.com',
    phoneNumber: '+234 803 345 6789',
    isActive: true,
    status: 'APPROVED',
  },
  {
    name: 'Sohcahtoa Lekki',
    state: 'Lagos',
    address: 'Plot 5, Admiralty Way, Lekki Phase 1, Lagos',
    branchManager: 'Funmilayo Balogun',
    email: 'lekki@sohcahtoa.com',
    phoneNumber: '+234 803 456 7890',
    isActive: true,
    status: 'APPROVED',
  },
  {
    name: 'Sohcahtoa Surulere',
    state: 'Lagos',
    address: '67 Adeniran Ogunsanya Street, Surulere, Lagos',
    branchManager: 'Ibrahim Musa',
    email: 'surulere@sohcahtoa.com',
    phoneNumber: '+234 803 567 8901',
    isActive: true,
    status: 'APPROVED',
  },

  // Abuja (FCT)
  {
    name: 'Sohcahtoa Wuse',
    state: 'FCT',
    address: '23 Adetokunbo Ademola Crescent, Wuse II, Abuja',
    branchManager: 'Amina Bello',
    email: 'wuse@sohcahtoa.com',
    phoneNumber: '+234 809 123 4567',
    isActive: true,
    status: 'APPROVED',
  },
  {
    name: 'Sohcahtoa Garki',
    state: 'FCT',
    address: '15 Herbert Macaulay Way, Garki, Abuja',
    branchManager: 'Emeka Nwankwo',
    email: 'garki@sohcahtoa.com',
    phoneNumber: '+234 809 234 5678',
    isActive: true,
    status: 'APPROVED',
  },
  {
    name: 'Sohcahtoa Maitama',
    state: 'FCT',
    address: '8 Kumasi Crescent, Maitama, Abuja',
    branchManager: 'Blessing Okoro',
    email: 'maitama@sohcahtoa.com',
    phoneNumber: '+234 809 345 6789',
    isActive: true,
    status: 'APPROVED',
  },

  // Port Harcourt (Rivers State)
  {
    name: 'Sohcahtoa Port Harcourt GRA',
    state: 'Rivers',
    address: '34 Aba Road, GRA Phase 2, Port Harcourt',
    branchManager: 'Ngozi Eze',
    email: 'ph.gra@sohcahtoa.com',
    phoneNumber: '+234 807 123 4567',
    isActive: true,
    status: 'APPROVED',
  },
  {
    name: 'Sohcahtoa Port Harcourt Trans-Amadi',
    state: 'Rivers',
    address: '12 Trans-Amadi Industrial Layout, Port Harcourt',
    branchManager: 'Chukwuma Onyeka',
    email: 'ph.transamadi@sohcahtoa.com',
    phoneNumber: '+234 807 234 5678',
    isActive: true,
    status: 'APPROVED',
  },

  // Kano State
  {
    name: 'Sohcahtoa Kano Sabon Gari',
    state: 'Kano',
    address: '56 Ibrahim Taiwo Road, Sabon Gari, Kano',
    branchManager: 'Abubakar Sadiq',
    email: 'kano.sabongari@sohcahtoa.com',
    phoneNumber: '+234 806 123 4567',
    isActive: true,
    status: 'APPROVED',
  },
  {
    name: 'Sohcahtoa Kano City',
    state: 'Kano',
    address: '23 Murtala Mohammed Way, Kano',
    branchManager: 'Fatima Aliyu',
    email: 'kano.city@sohcahtoa.com',
    phoneNumber: '+234 806 234 5678',
    isActive: true,
    status: 'APPROVED',
  },

  // Ibadan (Oyo State)
  {
    name: 'Sohcahtoa Ibadan Bodija',
    state: 'Oyo',
    address: '18 Awolowo Avenue, Bodija, Ibadan',
    branchManager: 'Adekunle Adeyemi',
    email: 'ibadan.bodija@sohcahtoa.com',
    phoneNumber: '+234 805 123 4567',
    isActive: true,
    status: 'APPROVED',
  },
  {
    name: 'Sohcahtoa Ibadan Dugbe',
    state: 'Oyo',
    address: '45 Lebanon Street, Dugbe, Ibadan',
    branchManager: 'Kehinde Oladele',
    email: 'ibadan.dugbe@sohcahtoa.com',
    phoneNumber: '+234 805 234 5678',
    isActive: true,
    status: 'APPROVED',
  },

  // Enugu State
  {
    name: 'Sohcahtoa Enugu GRA',
    state: 'Enugu',
    address: '22 Okpara Avenue, GRA, Enugu',
    branchManager: 'Chioma Nnamani',
    email: 'enugu.gra@sohcahtoa.com',
    phoneNumber: '+234 808 123 4567',
    isActive: true,
    status: 'APPROVED',
  },
  {
    name: 'Sohcahtoa Enugu Ogui Road',
    state: 'Enugu',
    address: '67 Ogui Road, Enugu',
    branchManager: 'Uchenna Obinna',
    email: 'enugu.ogui@sohcahtoa.com',
    phoneNumber: '+234 808 234 5678',
    isActive: true,
    status: 'APPROVED',
  },

  // Kaduna State
  {
    name: 'Sohcahtoa Kaduna Junction',
    state: 'Kaduna',
    address: '14 Ali Akilu Road, Kaduna Junction, Kaduna',
    branchManager: 'Yusuf Mohammed',
    email: 'kaduna.junction@sohcahtoa.com',
    phoneNumber: '+234 810 123 4567',
    isActive: true,
    status: 'APPROVED',
  },
  {
    name: 'Sohcahtoa Kaduna Sabon Tasha',
    state: 'Kaduna',
    address: '33 Kachia Road, Sabon Tasha, Kaduna',
    branchManager: 'Halima Usman',
    email: 'kaduna.sabontasha@sohcahtoa.com',
    phoneNumber: '+234 810 234 5678',
    isActive: true,
    status: 'APPROVED',
  },

  // Benin City (Edo State)
  {
    name: 'Sohcahtoa Benin Ring Road',
    state: 'Edo',
    address: '89 Ring Road, Benin City',
    branchManager: 'Osaze Omoregie',
    email: 'benin.ringroad@sohcahtoa.com',
    phoneNumber: '+234 811 123 4567',
    isActive: true,
    status: 'APPROVED',
  },
  {
    name: 'Sohcahtoa Benin Akpakpava',
    state: 'Edo',
    address: '25 Akpakpava Road, Benin City',
    branchManager: 'Esohe Iguodala',
    email: 'benin.akpakpava@sohcahtoa.com',
    phoneNumber: '+234 811 234 5678',
    isActive: true,
    status: 'APPROVED',
  },

  // Calabar (Cross River State)
  {
    name: 'Sohcahtoa Calabar MCC',
    state: 'Cross River',
    address: '12 Marian Road, Calabar Municipal, Calabar',
    branchManager: 'Bassey Edet',
    email: 'calabar.mcc@sohcahtoa.com',
    phoneNumber: '+234 812 123 4567',
    isActive: true,
    status: 'APPROVED',
  },

  // Owerri (Imo State)
  {
    name: 'Sohcahtoa Owerri Wetheral',
    state: 'Imo',
    address: '45 Wetheral Road, Owerri',
    branchManager: 'Chinonso Okafor',
    email: 'owerri.wetheral@sohcahtoa.com',
    phoneNumber: '+234 813 123 4567',
    isActive: true,
    status: 'APPROVED',
  },

  // Abeokuta (Ogun State)
  {
    name: 'Sohcahtoa Abeokuta Panseke',
    state: 'Ogun',
    address: '28 Quarry Road, Panseke, Abeokuta',
    branchManager: 'Olufunke Ogunleye',
    email: 'abeokuta.panseke@sohcahtoa.com',
    phoneNumber: '+234 814 123 4567',
    isActive: true,
    status: 'APPROVED',
  },

  // Warri (Delta State)
  {
    name: 'Sohcahtoa Warri Effurun',
    state: 'Delta',
    address: '56 Effurun-Sapele Road, Warri',
    branchManager: 'Oghenetega Edafe',
    email: 'warri.effurun@sohcahtoa.com',
    phoneNumber: '+234 815 123 4567',
    isActive: true,
    status: 'APPROVED',
  },

  // Jos (Plateau State)
  {
    name: 'Sohcahtoa Jos Terminus',
    state: 'Plateau',
    address: '19 Ahmadu Bello Way, Jos Terminus, Jos',
    branchManager: 'Danjuma Gyang',
    email: 'jos.terminus@sohcahtoa.com',
    phoneNumber: '+234 816 123 4567',
    isActive: true,
    status: 'APPROVED',
  },

  // Akure (Ondo State)
  {
    name: 'Sohcahtoa Akure Alagbaka',
    state: 'Ondo',
    address: '34 Oyemekun Road, Alagbaka, Akure',
    branchManager: 'Femi Ajayi',
    email: 'akure.alagbaka@sohcahtoa.com',
    phoneNumber: '+234 817 123 4567',
    isActive: true,
    status: 'APPROVED',
  },

  // Uyo (Akwa Ibom State)
  {
    name: 'Sohcahtoa Uyo Plaza',
    state: 'Akwa Ibom',
    address: '23 Aka Road, Uyo',
    branchManager: 'Edidiong Akpan',
    email: 'uyo.plaza@sohcahtoa.com',
    phoneNumber: '+234 818 123 4567',
    isActive: true,
    status: 'APPROVED',
  },
];

async function seedPickupLocations() {
  console.log('🌱 Starting pickup locations seed...');

  try {
    // Check if branches already exist
    const existingCount = await prisma.branch.count();

    if (existingCount > 0) {
      console.log(`✅ Found ${existingCount} existing branches in database`);
      console.log('   Skipping seed - branches already exist');
      console.log('   To re-seed, manually delete existing branches first');
      return;
    }

    // Seed pickup locations
    console.log(`📍 Creating ${pickupLocations.length} pickup locations...`);

    let successCount = 0;
    let failureCount = 0;

    for (const location of pickupLocations) {
      try {
        await prisma.branch.create({
          data: location,
        });
        successCount++;
        console.log(`   ✓ Created: ${location.name}`);
      } catch (error) {
        failureCount++;
        console.error(`   ✗ Failed to create ${location.name}:`, error);
      }
    }

    console.log('\n📊 Seed Summary:');
    console.log(`   ✅ Successfully created: ${successCount} branches`);
    if (failureCount > 0) {
      console.log(`   ❌ Failed: ${failureCount} branches`);
    }

    // Display branch distribution by state
    const branches = await prisma.branch.findMany({
      select: {
        state: true,
      },
    });

    const stateDistribution = branches.reduce(
      (acc, branch) => {
        acc[branch.state] = (acc[branch.state] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    console.log('\n🗺️  Branch Distribution by State:');
    Object.entries(stateDistribution)
      .sort(([, a], [, b]) => b - a)
      .forEach(([state, count]) => {
        console.log(`   ${state}: ${count} branch${count > 1 ? 'es' : ''}`);
      });

    console.log('\n🎉 Pickup locations seed completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding pickup locations:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed
seedPickupLocations()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
