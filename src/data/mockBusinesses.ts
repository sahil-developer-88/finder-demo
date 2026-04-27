
export const mockBusinesses = [
  {
    id: 1,
    businessName: "Digital Marketing Solutions",
    category: "Marketing",
    servicesOffered: ["Social Media Management", "SEO", "Content Creation"],
    wantingInReturn: ["Legal Services", "Accounting"],
    estimatedValue: 500,
    location: "San Francisco, CA",
    contactMethod: "email@digitalmarketing.com",
    rating: 4.8,
    reviews: 23,
    verified: true,
    points: 150,
    image: "photo-1460925895917-afdab827c52f",
    description: "Professional digital marketing services to grow your online presence",
    website: "https://digitalmarketing.com",
    socialMedia: {
      instagram: "@digitalmarketing",
      twitter: "@digmarketing",
      facebook: "digitalmarketingsolutions",
      linkedin: "company/digital-marketing-solutions"
    },
    pricedItems: [
      { name: "Logo Design Package", price: 200, points: 20 },
      { name: "SEO Audit", price: 150, points: 15 },
      { name: "Social Media Setup", price: 100, points: 10 }
    ]
  },
  {
    id: 2,
    businessName: "Legal Advisory Group",
    category: "Legal",
    servicesOffered: ["Business Law", "Contract Review", "Compliance"],
    wantingInReturn: ["Marketing Services", "Web Development"],
    estimatedValue: 750,
    location: "New York, NY",
    contactMethod: "contact@legaladvisory.com",
    rating: 4.9,
    reviews: 41,
    verified: true,
    points: 320,
    image: "photo-1589829545856-d10d557cf95f",
    description: "Expert legal services for small to medium businesses",
    website: "https://legaladvisory.com",
    socialMedia: {
      linkedin: "company/legal-advisory-group",
      twitter: "@legaladvisory"
    },
    pricedItems: [
      { name: "Contract Review", price: 300, points: 30 },
      { name: "Legal Consultation", price: 250, points: 25 }
    ]
  },
  {
    id: 3,
    businessName: "Creative Design Studio",
    category: "Design",
    servicesOffered: ["Logo Design", "Branding", "UI/UX Design"],
    wantingInReturn: ["Photography", "Copywriting"],
    estimatedValue: 400,
    location: "Austin, TX",
    contactMethod: "hello@creativedesign.com",
    rating: 4.7,
    reviews: 18,
    verified: false,
    points: 85,
    image: "photo-1561736778-92e52a7769ef",
    description: "Modern design solutions for forward-thinking businesses",
    website: "https://creativedesign.com",
    socialMedia: {
      instagram: "@creativedesignstudio",
      facebook: "creativedesignstudio",
      linkedin: "company/creative-design-studio"
    },
    pricedItems: [
      { name: "Logo Design", price: 180, points: 18 },
      { name: "Brand Identity Package", price: 400, points: 40 },
      { name: "Website Mockup", price: 220, points: 22 }
    ]
  }
];

export const categories = [
  "All Categories",
  "Marketing",
  "Legal",
  "Design",
  "Technology",
  "Health & Wellness",
  "Consulting",
  "Photography",
  "Writing",
  "Finance"
];
