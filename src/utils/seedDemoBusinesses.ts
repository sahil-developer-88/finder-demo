import { supabase } from "@/integrations/supabase/client";

interface DemoBusiness {
  business_name: string;
  category: string;
  services_offered: string[];
  wanting_in_return: string[];
  estimated_value: number;
  location: string;
  contact_method: string;
  description: string;
  barter_percentage: number;
  status: string;
}

const demoBusinesses: DemoBusiness[] = [
  {
    business_name: "Green Thumb Landscaping",
    category: "Home & Garden",
    services_offered: ["Lawn Care", "Garden Design", "Tree Trimming", "Seasonal Cleanup"],
    wanting_in_return: ["Plumbing Services", "Electrical Work", "Marketing Services"],
    estimated_value: 2500,
    location: "Portland, OR",
    contact_method: "landscaping@greenthumb.com",
    description: "Professional landscaping services with 15 years of experience. We specialize in sustainable garden design and organic lawn care.",
    barter_percentage: 30,
    status: "active"
  },
  {
    business_name: "First Choice Accounting",
    category: "Professional Services",
    services_offered: ["Tax Preparation", "Bookkeeping", "Financial Planning", "Payroll Services"],
    wanting_in_return: ["Office Supplies", "Computer Repair", "Cleaning Services", "Catering"],
    estimated_value: 5000,
    location: "Austin, TX",
    contact_method: "info@firstchoiceaccounting.com",
    description: "Certified public accountants helping small businesses manage their finances and maximize tax savings.",
    barter_percentage: 25,
    status: "active"
  },
  {
    business_name: "Elite Fitness Training",
    category: "Health & Wellness",
    services_offered: ["Personal Training", "Nutrition Coaching", "Group Classes", "Wellness Consulting"],
    wanting_in_return: ["Legal Services", "Marketing", "Website Development", "Photography"],
    estimated_value: 3000,
    location: "Denver, CO",
    contact_method: "coach@elitefitness.com",
    description: "Transform your health with personalized training programs. Certified trainers with proven results.",
    barter_percentage: 40,
    status: "active"
  },
  {
    business_name: "Creative Canvas Marketing",
    category: "Marketing & Advertising",
    services_offered: ["Social Media Management", "Brand Design", "Content Creation", "SEO Services"],
    wanting_in_return: ["Office Space", "Professional Services", "IT Support", "Printing Services"],
    estimated_value: 4500,
    location: "Seattle, WA",
    contact_method: "hello@creativecanvas.co",
    description: "Full-service digital marketing agency specializing in small business growth and brand development.",
    barter_percentage: 35,
    status: "active"
  },
  {
    business_name: "TechFix Solutions",
    category: "Technology",
    services_offered: ["Computer Repair", "Network Setup", "Data Recovery", "IT Consulting"],
    wanting_in_return: ["Office Furniture", "Cleaning Services", "Catering", "Marketing Services"],
    estimated_value: 3500,
    location: "San Francisco, CA",
    contact_method: "support@techfixsolutions.com",
    description: "Fast and reliable tech support for businesses and individuals. Same-day service available.",
    barter_percentage: 20,
    status: "active"
  },
  {
    business_name: "Sunshine Cleaning Co",
    category: "Cleaning & Maintenance",
    services_offered: ["Office Cleaning", "Carpet Cleaning", "Window Washing", "Deep Cleaning"],
    wanting_in_return: ["Accounting Services", "Legal Services", "Vehicle Maintenance", "Advertising"],
    estimated_value: 2000,
    location: "Phoenix, AZ",
    contact_method: "info@sunshinecleaning.com",
    description: "Professional cleaning services using eco-friendly products. Insured and bonded team.",
    barter_percentage: 50,
    status: "active"
  },
  {
    business_name: "Legal Eagle Law Firm",
    category: "Legal Services",
    services_offered: ["Business Law", "Contract Review", "LLC Formation", "Trademark Registration"],
    wanting_in_return: ["Accounting", "Office Supplies", "Marketing", "Web Development"],
    estimated_value: 8000,
    location: "Chicago, IL",
    contact_method: "contact@legaleaglelaw.com",
    description: "Experienced business attorneys helping entrepreneurs protect and grow their companies.",
    barter_percentage: 15,
    status: "active"
  },
  {
    business_name: "Fresh Bites Catering",
    category: "Food & Beverage",
    services_offered: ["Event Catering", "Meal Prep", "Corporate Lunches", "Special Events"],
    wanting_in_return: ["Marketing Services", "Accounting", "Equipment Rental", "Transportation"],
    estimated_value: 3000,
    location: "Miami, FL",
    contact_method: "orders@freshbitescatering.com",
    description: "Farm-to-table catering service perfect for corporate events and special occasions.",
    barter_percentage: 30,
    status: "active"
  }
];

export const seedDemoBusinesses = async (userId: string) => {
  try {
    const businessesToInsert = demoBusinesses.map(business => ({
      ...business,
      user_id: userId
    }));

    const { data, error } = await supabase
      .from('businesses')
      .insert(businessesToInsert)
      .select();

    if (error) throw error;

    console.log(`Successfully created ${data?.length || 0} demo businesses`);
    return { success: true, count: data?.length || 0 };
  } catch (error) {
    console.error('Error seeding demo businesses:', error);
    return { success: false, error };
  }
};

export const clearDemoBusinesses = async () => {
  try {
    // Only delete businesses that match demo business names
    const demoNames = demoBusinesses.map(b => b.business_name);
    
    const { error } = await supabase
      .from('businesses')
      .delete()
      .in('business_name', demoNames);

    if (error) throw error;

    console.log('Successfully cleared demo businesses');
    return { success: true };
  } catch (error) {
    console.error('Error clearing demo businesses:', error);
    return { success: false, error };
  }
};
