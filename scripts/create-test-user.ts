import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/db/prisma';

// Supabaseクライアントの作成（管理者権限）
const supabaseAdmin = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function createTestUser() {
  try {
    console.log('Creating test user...');
    
    // Supabase Authでテストユーザーを作成
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'test@example.com',
      password: 'testpass123',
      email_confirm: true
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return;
    }

    console.log('Auth user created:', authData.user?.id);

    // Prismaでユーザーレコードを作成
    const user = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        id: authData.user!.id,
        email: 'test@example.com',
        name: 'Test User'
      }
    });

    console.log('Database user created:', user);
    console.log('\nTest account created successfully!');
    console.log('Email: test@example.com');
    console.log('Password: testpass123');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();