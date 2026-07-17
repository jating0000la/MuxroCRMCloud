import React, { useState, useMemo } from 'react';

// Bundled stock background images, served from /public/form-bg (stable, non-hashed
// URLs — safe to persist in a saved form's page config since they won't change
// between deploys, unlike content-hashed assets imported from src/).
const FORM_BG_FILES = [
  'pexels-codioful-7135053.jpg',
  'pexels-codioful-7135020.jpg',
  'pexels-codioful-7135014.jpg',
  'pexels-codioful-7135013.jpg',
  'pexels-codioful-7135004.jpg',
  'pexels-codioful-7134981.jpg',
  'pexels-70588695-19248457.jpg',
  'pexels-jess-vide-5008007.jpg',
  'pexels-francesco-ungaro-13216333.jpg',
  'pexels-enginakyurt-6138036.jpg',
  'pexels-edward-jenner-4253051.jpg',
  'pexels-nickcollins-1293120.jpg',
  'pexels-martinpechy-2078266.jpg',
  'pexels-padrinan-19670.jpg',
  'pexels-padrinan-255379.jpg',
  'pexels-steve-25372910.jpg',
  'pexels-robert-clark-504241532-26834228.jpg',
  'pexels-pedroesparza-248514727-12726784.jpg',
  'pexels-steve-26771256.jpg',
  'pexels-steve-26771259.jpg',
];

const FORM_BG_PRESETS: { url: string; label: string }[] = FORM_BG_FILES.map((file, i) => ({
  url: `/form-bg/${file}`,
  label: `Background ${i + 1}`,
}));

interface FormBuilderField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  min?: number;
  max?: number;
  rows?: string[];
  columns?: string[];
  meta?: any;
}

type FormDesignTheme = 'ocean' | 'sunset' | 'forest' | 'royal';
type FormDesignLayout = 'centered' | 'split';
type FormButtonStyle = 'solid' | 'gradient' | 'outline';
type FormRadiusStyle = 'soft' | 'rounded' | 'pill';

interface FormDesign {
  theme: FormDesignTheme;
  layout: FormDesignLayout;
  buttonStyle: FormButtonStyle;
  radius: FormRadiusStyle;
  showProgress: boolean;
  customColor: string;
}

interface FormCommunication {
  whatsappEnabled: boolean;
  templateId: string;
  greetingMessage: string;
}

const DEFAULT_FORM_COMMUNICATION: FormCommunication = {
  whatsappEnabled: false,
  templateId: '',
  greetingMessage: '',
};

const DEFAULT_FORM_DESIGN: FormDesign = {
  theme: 'ocean',
  layout: 'centered',
  buttonStyle: 'gradient',
  radius: 'rounded',
  showProgress: true,
  customColor: '#0ea5e9',
};

const DEFAULT_FIELDS: FormBuilderField[] = [
  { name: 'name', label: 'Full Name', type: 'text', required: true },
  { name: 'email', label: 'Email Address', type: 'text', required: false },
  { name: 'phone', label: 'Phone Number', type: 'text', required: false },
];

const BASIC_COLORS = [
  '#f87171', '#ef4444', '#b91c1c', '#f59e0b', '#facc15', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#fb7185', '#fb923c', '#fbbf24', '#a3e635', '#4ade80', '#34d399',
  '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185', '#fca5a5', '#fdba74',
  '#fcd34d', '#bef264', '#86efac', '#6ee7b7', '#5eead4', '#67e8f9', '#7dd3fc', '#93c5fd', '#a5b4fc', '#c4b5fd', '#d8b4fe', '#f0abfc',
];

const EMPTY_CUSTOM_SLOTS = Array.from({ length: 24 }, () => '');

// ─── Page Builder ──────────────────────────────────────────────────────────────

const FONT_OPTIONS = [
  { value: 'system', label: 'System Default' },
  { value: 'inter', label: 'Inter (Modern)' },
  { value: 'roboto', label: 'Roboto (Clean)' },
  { value: 'poppins', label: 'Poppins (Friendly)' },
  { value: 'montserrat', label: 'Montserrat (Bold)' },
  { value: 'lato', label: 'Lato (Professional)' },
  { value: 'opensans', label: 'Open Sans (Readable)' },
  { value: 'playfair', label: 'Playfair Display (Elegant)' },
];

interface PageConfig {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  backgroundImage: string;
  fontFamily: string;
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  companyLogo: string;
  bannerImage: string;
  showAbout: boolean;
  aboutTitle: string;
  aboutText: string;
  showServices: boolean;
  servicesTitle: string;
  services: Array<{ title: string; description: string }>;
  showWhyUs: boolean;
  whyUsTitle: string;
  whyUsPoints: string[];
  showGallery: boolean;
  galleryImages: string[];
  showContact: boolean;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  showMap: boolean;
  mapEmbedUrl: string;
  companyName: string;
  footerText: string;
  privacyUrl: string;
  termsUrl: string;
  thankYouTitle: string;
  thankYouMessage: string;
  thankYouPhone: string;
  thankYouEmail: string;
  thankYouRedirectUrl: string;
  showWhatsapp: boolean;
  whatsappNumber: string;
  showCall: boolean;
  callNumber: string;
  showEmail: boolean;
  contactEmailBtn: string;
  metaTitle: string;
  metaDescription: string;
  faviconUrl: string;
}

const DEFAULT_PAGE_CONFIG: PageConfig = {
  primaryColor: '#0ea5e9',
  secondaryColor: '#6366f1',
  backgroundColor: '#f8fafc',
  backgroundImage: '',
  fontFamily: 'system',
  borderRadius: 'md',
  companyLogo: '',
  bannerImage: '',
  showAbout: false,
  aboutTitle: 'About Us',
  aboutText: '',
  showServices: false,
  servicesTitle: 'Our Services',
  services: [
    { title: 'Service One', description: 'Brief description of your first service.' },
    { title: 'Service Two', description: 'Brief description of your second service.' },
  ],
  showWhyUs: false,
  whyUsTitle: 'Why Choose Us',
  whyUsPoints: ['Fast Response', 'Professional Team', 'Quality Service', 'Affordable Pricing'],
  showGallery: false,
  galleryImages: ['', '', '', '', '', ''],
  showContact: false,
  contactPhone: '',
  contactEmail: '',
  contactAddress: '',
  showMap: false,
  mapEmbedUrl: '',
  companyName: '',
  footerText: '',
  privacyUrl: '',
  termsUrl: '',
  thankYouTitle: 'Thank You!',
  thankYouMessage: 'Your submission has been received. We will get back to you shortly.',
  thankYouPhone: '',
  thankYouEmail: '',
  thankYouRedirectUrl: '',
  showWhatsapp: false,
  whatsappNumber: '',
  showCall: false,
  callNumber: '',
  showEmail: false,
  contactEmailBtn: '',
  metaTitle: '',
  metaDescription: '',
  faviconUrl: '',
};

type PageTemplate = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  fields: Array<{ name: string; label: string; type: string; required: boolean; placeholder?: string; options?: string[] }>;
  pageConfig: Partial<PageConfig>;
};

const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: 'contact',
    name: 'Contact Us',
    emoji: '📬',
    description: 'Simple contact form',
    fields: [
      { name: 'name', label: 'Full Name', type: 'text', required: true },
      { name: 'phone', label: 'Phone Number', type: 'text', required: true },
      { name: 'email', label: 'Email Address', type: 'text', required: false },
      { name: 'message', label: 'Message', type: 'textarea', required: false },
    ],
    pageConfig: {
      showWhyUs: true,
      whyUsPoints: ['Quick Response', 'Professional Support', 'Customer First', '24/7 Availability'],
      showContact: true,
      thankYouTitle: 'Message Received!',
      thankYouMessage: 'Thank you for reaching out. We will get back to you within 24 hours.',
    },
  },
  {
    id: 'product',
    name: 'Product Enquiry',
    emoji: '🛍️',
    description: 'Product inquiry with services section',
    fields: [
      { name: 'name', label: 'Full Name', type: 'text', required: true },
      { name: 'phone', label: 'Phone Number', type: 'text', required: true },
      { name: 'email', label: 'Email Address', type: 'text', required: false },
      { name: 'product', label: 'Product Interest', type: 'select', required: true, options: ['Product A', 'Product B', 'Product C'] },
      { name: 'message', label: 'Message', type: 'textarea', required: false },
    ],
    pageConfig: {
      showServices: true,
      servicesTitle: 'Our Products',
      services: [
        { title: 'Product A', description: 'Description of Product A and its key benefits.' },
        { title: 'Product B', description: 'Description of Product B and its key benefits.' },
        { title: 'Product C', description: 'Description of Product C and its key benefits.' },
      ],
      showWhyUs: true,
      whyUsPoints: ['Best Quality', 'Competitive Pricing', 'Fast Delivery', 'After-sale Support'],
    },
  },
  {
    id: 'service',
    name: 'Service Enquiry',
    emoji: '⚙️',
    description: 'Service inquiry with about section',
    fields: [
      { name: 'name', label: 'Full Name', type: 'text', required: true },
      { name: 'phone', label: 'Phone Number', type: 'text', required: true },
      { name: 'service', label: 'Service Required', type: 'select', required: true, options: ['Service A', 'Service B', 'Service C'] },
      { name: 'city', label: 'City', type: 'text', required: false },
      { name: 'message', label: 'Requirements', type: 'textarea', required: false },
    ],
    pageConfig: {
      showAbout: true,
      aboutTitle: 'About Our Company',
      aboutText: 'We provide professional services with a commitment to quality and customer satisfaction.',
      showWhyUs: true,
      whyUsPoints: ['10+ Years Experience', 'Certified Professionals', 'Quality Guaranteed', 'On-time Delivery'],
    },
  },
  {
    id: 'appointment',
    name: 'Appointment Booking',
    emoji: '📅',
    description: 'Book appointments or consultations',
    fields: [
      { name: 'name', label: 'Full Name', type: 'text', required: true },
      { name: 'phone', label: 'Phone Number', type: 'text', required: true },
      { name: 'email', label: 'Email Address', type: 'text', required: false },
      { name: 'appointment_date', label: 'Preferred Date', type: 'date', required: true },
      { name: 'purpose', label: 'Purpose of Visit', type: 'select', required: true, options: ['Consultation', 'Follow-up', 'New Inquiry'] },
    ],
    pageConfig: {
      showContact: true,
      showWhyUs: true,
      whyUsPoints: ['Flexible Timing', 'Expert Consultation', 'No Hidden Charges', 'Personalized Service'],
      thankYouTitle: 'Appointment Requested!',
      thankYouMessage: 'We will confirm your appointment slot shortly.',
    },
  },
  {
    id: 'job',
    name: 'Job Application',
    emoji: '💼',
    description: 'Professional job application form',
    fields: [
      { name: 'name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email Address', type: 'text', required: true },
      { name: 'phone', label: 'Phone Number', type: 'text', required: true },
      { name: 'position', label: 'Position Applied For', type: 'select', required: true, options: ['Sales Executive', 'Marketing Manager', 'Developer', 'Other'] },
      { name: 'experience', label: 'Years of Experience', type: 'select', required: true, options: ['0-1 years', '1-3 years', '3-5 years', '5+ years'] },
      { name: 'message', label: 'Cover Letter', type: 'textarea', required: false },
    ],
    pageConfig: {
      showAbout: true,
      aboutTitle: 'Join Our Team',
      aboutText: 'We are a growing company looking for passionate individuals. We offer competitive salaries, great benefits, and a positive work culture.',
      showWhyUs: true,
      whyUsTitle: 'Why Work With Us',
      whyUsPoints: ['Competitive Salary', 'Career Growth', 'Great Work Culture', 'Learning Opportunities'],
      thankYouTitle: 'Application Submitted!',
      thankYouMessage: 'We will review your application and get back to you within 5 business days.',
    },
  },
  {
    id: 'event',
    name: 'Event Registration',
    emoji: '🎉',
    description: 'Register for events or webinars',
    fields: [
      { name: 'name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email Address', type: 'text', required: true },
      { name: 'phone', label: 'Phone Number', type: 'text', required: true },
      { name: 'attendees', label: 'Number of Attendees', type: 'select', required: true, options: ['1', '2', '3', '4', '5+'] },
    ],
    pageConfig: {
      showAbout: true,
      aboutTitle: 'About the Event',
      aboutText: 'Join us for an exciting event! Network with industry leaders, gain insights, and enjoy a day of learning and collaboration.',
      showContact: true,
      thankYouTitle: 'Registration Confirmed!',
      thankYouMessage: 'You are registered! We will send event details to your email shortly.',
    },
  },
];

interface InitialForm {
  id: string;
  title: string;
  fields: FormBuilderField[];
}

interface FormBuilderProps {
  initialForm?: InitialForm;
  onSubmit: (title: string, fields: FormBuilderField[]) => void;
  onCancel: () => void;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Short answer', icon: 'T' },
  { value: 'textarea', label: 'Paragraph', icon: '¶' },
  { value: 'radio', label: 'Multiple choice', icon: '◉' },
  { value: 'checkbox', label: 'Checkboxes', icon: '☑' },
  { value: 'select', label: 'Drop-down', icon: '▾' },
  { value: 'linear_scale', label: 'Linear scale', icon: '─' },
  { value: 'rating', label: 'Rating', icon: '★' },
  { value: 'multiple_choice_grid', label: 'Choice grid', icon: '⊞' },
  { value: 'checkbox_grid', label: 'Tick box grid', icon: '⊠' },
  { value: 'date', label: 'Date', icon: '📅' },
  { value: 'time', label: 'Time', icon: '◷' },
];

export default function FormBuilder({ initialForm, onSubmit, onCancel }: FormBuilderProps) {
  const initialConfig = useMemo(() => {
    const sourceFields = initialForm?.fields || DEFAULT_FIELDS;
    const metaField = sourceFields.find((f) => f.type === '__design_meta' || f.name === '__form_meta');
    const safeDesign = {
      ...DEFAULT_FORM_DESIGN,
      ...(metaField?.meta?.design || {}),
    } as FormDesign;
    const safeComm = {
      ...DEFAULT_FORM_COMMUNICATION,
      ...(metaField?.meta?.communication || {}),
    } as FormCommunication;

    return {
      title: initialForm?.title || '',
      description: metaField?.meta?.description || '',
      design: safeDesign,
      communication: safeComm,
      pageConfig: {
        ...DEFAULT_PAGE_CONFIG,
        ...(metaField?.meta?.pageConfig || {}),
        services: metaField?.meta?.pageConfig?.services ?? DEFAULT_PAGE_CONFIG.services,
        whyUsPoints: metaField?.meta?.pageConfig?.whyUsPoints ?? DEFAULT_PAGE_CONFIG.whyUsPoints,
        galleryImages: metaField?.meta?.pageConfig?.galleryImages ?? DEFAULT_PAGE_CONFIG.galleryImages,
      } as PageConfig,
      fields: sourceFields.filter((f) => f.type !== '__design_meta' && f.name !== '__form_meta'),
    };
  }, [initialForm]);

  const [title, setTitle] = useState(initialConfig.title);
  const [description, setDescription] = useState(initialConfig.description);
  const [fields, setFields] = useState<FormBuilderField[]>(initialConfig.fields.length > 0 ? initialConfig.fields : DEFAULT_FIELDS);
  const [design, setDesign] = useState<FormDesign>(initialConfig.design);
  const [communication, setCommunication] = useState<FormCommunication>(initialConfig.communication);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
  const [builderTab, setBuilderTab] = useState<'fields' | 'design' | 'communication' | 'page'>('fields');
  const [customColorSlots, setCustomColorSlots] = useState<string[]>(EMPTY_CUSTOM_SLOTS);
  const [pageConfig, setPageConfig] = useState<PageConfig>(initialConfig.pageConfig);
  const updatePageConfig = (patch: Partial<PageConfig>) => setPageConfig((prev) => ({ ...prev, ...patch }));

  const availableTags = useMemo(() => {
    return fields
      .filter((f) => ['text', 'textarea', 'select', 'radio', 'email', 'phone', 'number'].includes(f.type))
      .map((f) => ({ tag: f.name, label: f.label }));
  }, [fields]);

  const normalizeHexColor = (value: string) => {
    const trimmed = value.trim();
    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    return /^#([0-9a-fA-F]{6})$/.test(withHash) ? withHash : null;
  };

  const hexToRgb = (hex: string) => {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return { r: 14, g: 165, b: 233 };
    const h = normalized.slice(1);
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    const clamp = (n: number) => Math.max(0, Math.min(255, n));
    return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`.toUpperCase();
  };

  const currentRgb = useMemo(() => hexToRgb(design.customColor), [design.customColor]);

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'field';

  const uniqueName = (base: string, excludeIndex?: number) => {
    let candidate = base;
    let counter = 1;
    while (fields.some((f, i) => f.name === candidate && i !== excludeIndex)) {
      counter++;
      candidate = `${base}_${counter}`;
    }
    return candidate;
  };

  const addField = (type: string) => {
    const newField: FormBuilderField = {
      name: '',
      label: `New ${FIELD_TYPES.find((t) => t.value === type)?.label || 'Field'}`,
      type,
      required: false,
      placeholder: '',
      options: ['radio', 'checkbox', 'select', 'multiple_choice_grid', 'checkbox_grid'].includes(type)
        ? ['Option 1', 'Option 2']
        : undefined,
      min: type === 'linear_scale' || type === 'rating' ? 1 : undefined,
      max: type === 'linear_scale' || type === 'rating' ? 5 : undefined,
      rows: type === 'multiple_choice_grid' || type === 'checkbox_grid' ? ['Row 1', 'Row 2'] : undefined,
      columns: type === 'multiple_choice_grid' || type === 'checkbox_grid' ? ['Col 1', 'Col 2'] : undefined,
    };
    newField.name = uniqueName(slugify(newField.label));
    const newFields = [...fields, newField];
    setFields(newFields);
    setSelectedFieldIndex(newFields.length - 1);
  };

  const updateField = (index: number, key: string, value: any) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: value };
    if (key === 'label') updated[index].name = uniqueName(slugify(value), index);
    if (key === 'type') {
      const field = updated[index];
      delete field.options;
      delete field.min;
      delete field.max;
      delete field.rows;
      delete field.columns;
      if (['radio', 'checkbox', 'select', 'multiple_choice_grid', 'checkbox_grid'].includes(value)) {
        field.options = ['Option 1', 'Option 2'];
      }
      if (value === 'linear_scale' || value === 'rating') {
        field.min = 1;
        field.max = 5;
      }
      if (value === 'multiple_choice_grid' || value === 'checkbox_grid') {
        field.rows = ['Row 1', 'Row 2'];
        field.columns = ['Col 1', 'Col 2'];
      }
    }
    setFields(updated);
  };

  const deleteField = (index: number) => {
    if (fields.length <= 1) return;
    setFields(fields.filter((_, i) => i !== index));
    if (selectedFieldIndex === index) setSelectedFieldIndex(null);
    else if (selectedFieldIndex !== null && selectedFieldIndex > index) setSelectedFieldIndex(selectedFieldIndex - 1);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    const updated = [...fields];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setFields(updated);
  };

  const updateListItem = (fieldIndex: number, key: 'options' | 'rows' | 'columns', listIndex: number, value: string) => {
    const updated = [...fields];
    const list = [...(updated[fieldIndex][key] || [])];
    list[listIndex] = value;
    updated[fieldIndex] = { ...updated[fieldIndex], [key]: list };
    setFields(updated);
  };

  const addListItem = (fieldIndex: number, key: 'options' | 'rows' | 'columns') => {
    const updated = [...fields];
    const list = [...(updated[fieldIndex][key] || [])];
    list.push(`${key === 'options' ? 'Option' : key === 'rows' ? 'Row' : 'Col'} ${list.length + 1}`);
    updated[fieldIndex] = { ...updated[fieldIndex], [key]: list };
    setFields(updated);
  };

  const removeListItem = (fieldIndex: number, key: 'options' | 'rows' | 'columns', listIndex: number) => {
    const updated = [...fields];
    const list = (updated[fieldIndex][key] || []).filter((_: any, i: number) => i !== listIndex);
    updated[fieldIndex] = { ...updated[fieldIndex], [key]: list };
    setFields(updated);
  };

  const needsOptions = (type: string) => ['radio', 'checkbox', 'select'].includes(type);
  const needsGrid = (type: string) => ['multiple_choice_grid', 'checkbox_grid'].includes(type);
  const needsScale = (type: string) => type === 'linear_scale';
  const needsRating = (type: string) => type === 'rating';

  const duplicateField = (index: number) => {
    const field = fields[index];
    const copiedLabel = `${field.label} Copy`;
    const copied: FormBuilderField = {
      ...field,
      name: uniqueName(slugify(copiedLabel)),
      label: copiedLabel,
    };
    const updated = [...fields];
    updated.splice(index + 1, 0, copied);
    setFields(updated);
    setSelectedFieldIndex(index + 1);
  };

  const addLeadCaptureTemplate = () => {
    const requiredFields: FormBuilderField[] = [
      { name: 'name', label: 'Full Name', type: 'text', required: true, placeholder: 'Enter full name' },
      { name: 'phone', label: 'Phone Number', type: 'text', required: true, placeholder: 'Enter phone number' },
      { name: 'email', label: 'Email Address', type: 'text', required: false, placeholder: 'Enter email address' },
      { name: 'city', label: 'City', type: 'text', required: false, placeholder: 'Enter city' },
      {
        name: 'interest',
        label: 'Interested Service',
        type: 'select',
        required: true,
        options: ['Service A', 'Service B', 'Service C'],
      },
    ];
    setFields(requiredFields);
    setSelectedFieldIndex(0);
  };

  const renderFieldPreview = (field: FormBuilderField) => {
    switch (field.type) {
      case 'text':
        return <input disabled placeholder={field.placeholder || field.label} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100" />;
      case 'textarea':
        return <textarea disabled placeholder={field.placeholder || field.label} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 h-20" />;
      case 'radio':
        return (
          <div className="space-y-1 mt-1">
            {field.options?.map((o, i) => (
              <label key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input type="radio" disabled className="text-primary-600" />{o}
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <div className="space-y-1 mt-1">
            {field.options?.map((o, i) => (
              <label key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input type="checkbox" disabled className="text-primary-600 rounded" />{o}
              </label>
            ))}
          </div>
        );
      case 'select':
        return (
          <select disabled className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <option>Select...</option>
            {field.options?.map((o, i) => <option key={i}>{o}</option>)}
          </select>
        );
      case 'date':
        return <input type="date" disabled className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100" />;
      case 'time':
        return <input type="time" disabled className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100" />;
      case 'linear_scale':
        return (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-gray-400 dark:text-gray-500">{field.min}</span>
            {Array.from({ length: (field.max || 5) - (field.min || 1) + 1 }, (_, i) => (field.min || 1) + i).map((n) => (
              <span key={n} className="w-8 h-8 flex items-center justify-center border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-500 dark:text-gray-400">{n}</span>
            ))}
            <span className="text-xs text-gray-400 dark:text-gray-500">{field.max}</span>
          </div>
        );
      case 'rating':
        return (
          <div className="flex gap-1 mt-1">
            {Array.from({ length: field.max || 5 }, (_, i) => (
              <span key={i} className="text-xl text-gray-300 dark:text-gray-600">★</span>
            ))}
          </div>
        );
      case 'multiple_choice_grid':
      case 'checkbox_grid':
        return (
          <div className="mt-1 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  {field.columns?.map((c, i) => <th key={i} className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {field.rows?.map((r, i) => (
                  <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="p-2 text-sm text-gray-700 dark:text-gray-300">{r}</td>
                    {field.columns?.slice(1).map((_, ci) => (
                      <td key={ci} className="p-2 text-center">
                        <input type={field.type === 'checkbox_grid' ? 'checkbox' : 'radio'} disabled className="text-primary-600" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return <input disabled className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100" />;
    }
  };

  return (
    <div className="flex flex-col h-[90vh] bg-white dark:bg-gray-900">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        {/* Left: Title + field count */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled Form"
            className="text-sm font-semibold bg-transparent border-0 outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 min-w-0 w-48 focus:bg-gray-50 dark:focus:bg-gray-800 rounded px-1 -mx-1 transition-colors"
          />
          <span className="text-[10px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md flex-shrink-0 whitespace-nowrap">
            {fields.length} field{fields.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Center: Segment tabs */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
          {(['fields', 'design', 'communication', 'page'] as const).map((tab) => {
            const labels: Record<string, string> = { fields: 'Fields', design: 'Design', communication: 'Messages', page: 'Page' };
            return (
              <button
                key={tab}
                onClick={() => setBuilderTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  builderTab === tab
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!title.trim()) { alert('Form title is required'); return; }
              if (fields.length === 0) { alert('Add at least one field'); return; }
              const metaField: FormBuilderField = {
                name: '__form_meta',
                label: 'Form Meta',
                type: '__design_meta',
                required: false,
                meta: { description: description.trim(), design, communication, pageConfig },
              };
              onSubmit(title.trim(), [...fields, metaField]);
            }}
            className="px-4 py-1.5 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
          >
            {initialForm ? 'Update' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Body */}
      {builderTab === 'fields' ? (
        <div className="flex flex-1 min-h-0">
          {/* Left: Field palette */}
          <div className="w-44 bg-gray-50 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 p-3 overflow-y-auto flex-shrink-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Add Field</p>
            <button
              onClick={addLeadCaptureTemplate}
              className="w-full mb-2.5 px-2 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 transition-colors"
            >
              Lead Capture
            </button>
            <div className="space-y-0.5">
              {FIELD_TYPES.map((ft) => (
                <button
                  key={ft.value}
                  onClick={() => addField(ft.value)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 hover:shadow-sm transition-all"
                >
                  <span className="w-5 h-5 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-[10px] flex-shrink-0 shadow-sm">{ft.icon}</span>
                  <span className="truncate">{ft.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Center: Canvas */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-950">
            <div className="max-w-xl mx-auto">
              {/* Description */}
              <div className="mb-3">
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a short description (optional)..."
                  className="w-full text-xs text-gray-500 dark:text-gray-400 bg-transparent border-0 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-700 pb-1.5 border-b border-transparent focus:border-gray-200 dark:focus:border-gray-700 transition-colors"
                />
              </div>

              {/* Fields */}
              <div className="space-y-1.5 min-h-[200px]">
                {fields.length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                    <div className="text-3xl mb-2 opacity-30">📋</div>
                    <p className="text-sm font-medium text-gray-400 dark:text-gray-500 mb-1">No fields yet</p>
                    <p className="text-xs text-gray-300 dark:text-gray-600">Pick a field type on the left to start</p>
                  </div>
                ) : (
                  fields.map((field, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedFieldIndex(idx)}
                      className={`group relative rounded-xl border bg-white dark:bg-gray-900 cursor-pointer transition-all duration-150 ${
                        selectedFieldIndex === idx
                          ? 'border-primary-400 ring-2 ring-primary-100 dark:ring-primary-900/30 shadow-sm'
                          : 'border-gray-200 dark:border-gray-700/70 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 px-3 py-2.5">
                        <span className="text-gray-200 dark:text-gray-700 cursor-grab select-none text-xs flex-shrink-0">⠿</span>
                        <span className={`w-6 h-6 flex items-center justify-center rounded-md text-xs font-bold flex-shrink-0 ${
                          selectedFieldIndex === idx
                            ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}>
                          {FIELD_TYPES.find((ft) => ft.value === field.type)?.icon || 'T'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate block">
                            {field.label}{field.required && <span className="text-red-400 text-xs ml-0.5">*</span>}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {FIELD_TYPES.find((ft) => ft.value === field.type)?.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); moveField(idx, 'up'); }} disabled={idx === 0} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-20 text-gray-400" title="Move up">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); moveField(idx, 'down'); }} disabled={idx === fields.length - 1} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-20 text-gray-400" title="Move down">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); duplicateField(idx); }} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400" title="Duplicate">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteField(idx); }} disabled={fields.length <= 1} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-300 hover:text-red-500 disabled:opacity-20" title="Delete">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </div>
                      <div className="px-3 pb-2.5">
                        {renderFieldPreview(field)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Quick-add row */}
              <div className="mt-3 flex gap-1.5 flex-wrap">
                {FIELD_TYPES.slice(0, 5).map((ft) => (
                  <button
                    key={ft.value}
                    onClick={() => addField(ft.value)}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all"
                  >
                    <span>{ft.icon}</span><span>{ft.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Properties panel */}
          <div className="w-60 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 overflow-y-auto flex-shrink-0">
            {selectedFieldIndex !== null && fields[selectedFieldIndex] ? (() => {
              const sf = fields[selectedFieldIndex];
              return (
                <div className="p-3 space-y-3">
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Properties</span>
                    <button onClick={() => setSelectedFieldIndex(null)} className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Label</label>
                    <input
                      value={sf.label}
                      onChange={(e) => updateField(selectedFieldIndex, 'label', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-400 focus:border-primary-400 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                    <select
                      value={sf.type}
                      onChange={(e) => updateField(selectedFieldIndex, 'type', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-400 outline-none"
                    >
                      {FIELD_TYPES.map((ft) => (
                        <option key={ft.value} value={ft.value}>{ft.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Placeholder</label>
                    <input
                      value={sf.placeholder || ''}
                      onChange={(e) => updateField(selectedFieldIndex, 'placeholder', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-400 outline-none"
                      placeholder="Optional..."
                    />
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-2 bg-gray-50 dark:bg-gray-800/60 rounded-lg">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Required</span>
                    <button
                      type="button"
                      onClick={() => updateField(selectedFieldIndex, 'required', !sf.required)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${sf.required ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${sf.required ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  {/* Options for radio, checkbox, select */}
                  {needsOptions(sf.type) && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Options</label>
                      <div className="space-y-2">
                        {sf.options?.map((opt, oi) => (
                          <div key={oi} className="flex gap-2">
                            <input
                              value={opt}
                              onChange={(e) => updateListItem(selectedFieldIndex, 'options', oi, e.target.value)}
                              className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            />
                            <button
                              onClick={() => removeListItem(selectedFieldIndex, 'options', oi)}
                              disabled={(sf.options || []).length <= 1}
                              className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30"
                            >✕</button>
                          </div>
                        ))}
                        <button
                          onClick={() => addListItem(selectedFieldIndex, 'options')}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >+ Add option</button>
                      </div>
                    </div>
                  )}

                  {/* Linear scale */}
                  {needsScale(sf.type) && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Scale Range</label>
                      <div className="flex items-center gap-2">
                        <input type="number" value={sf.min || 1} onChange={(e) => updateField(selectedFieldIndex, 'min', parseInt(e.target.value) || 1)} className="w-16 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" min={0} max={10} />
                        <span className="text-gray-400 dark:text-gray-500">to</span>
                        <input type="number" value={sf.max || 5} onChange={(e) => updateField(selectedFieldIndex, 'max', parseInt(e.target.value) || 5)} className="w-16 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" min={1} max={10} />
                      </div>
                    </div>
                  )}

                  {/* Rating */}
                  {needsRating(sf.type) && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Max Stars</label>
                      <input type="number" value={sf.max || 5} onChange={(e) => updateField(selectedFieldIndex, 'max', Math.min(10, Math.max(1, parseInt(e.target.value) || 5)))} className="w-20 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" min={1} max={10} />
                    </div>
                  )}

                  {/* Grid rows/columns */}
                  {needsGrid(sf.type) && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Rows</label>
                        <div className="space-y-2">
                          {sf.rows?.map((row, ri) => (
                            <div key={ri} className="flex gap-2">
                              <input value={row} onChange={(e) => updateListItem(selectedFieldIndex, 'rows', ri, e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                              <button onClick={() => removeListItem(selectedFieldIndex, 'rows', ri)} disabled={(sf.rows || []).length <= 1} className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30">✕</button>
                            </div>
                          ))}
                          <button onClick={() => addListItem(selectedFieldIndex, 'rows')} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Add row</button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Columns</label>
                        <div className="space-y-2">
                          {sf.columns?.map((col, ci) => (
                            <div key={ci} className="flex gap-2">
                              <input value={col} onChange={(e) => updateListItem(selectedFieldIndex, 'columns', ci, e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                              <button onClick={() => removeListItem(selectedFieldIndex, 'columns', ci)} disabled={(sf.columns || []).length <= 1} className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30">✕</button>
                            </div>
                          ))}
                          <button onClick={() => addListItem(selectedFieldIndex, 'columns')} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Add column</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })() : (
              <div className="flex flex-col items-center justify-center h-full text-center p-4 mt-8">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center mb-2.5">
                  <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Click any field to edit</p>
              </div>
            )}
          </div>
        </div>
      ) : builderTab === 'communication' ? (
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">WhatsApp Communication</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Configure WhatsApp message templates for this form's submissions.</p>

            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Enable WhatsApp Greeting</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Send a WhatsApp template message when someone submits this form</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCommunication((prev) => ({ ...prev, whatsappEnabled: !prev.whatsappEnabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    communication.whatsappEnabled ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      communication.whatsappEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {communication.whatsappEnabled && (
                <>
                  <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Greeting Message</label>
                      <textarea
                        value={communication.greetingMessage}
                        onChange={(e) => setCommunication((prev) => ({ ...prev, greetingMessage: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm h-28 focus:ring-2 focus:ring-primary-500 font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        placeholder="Hi {{name}}, thank you for your inquiry! We'll get back to you at {{email}} shortly."
                      />
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Type <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{{field_name}}'}</code> to insert form answers. Uses WhatsApp session message (free within 24h of submission).</p>
                    </div>

                    {availableTags.length > 0 && (
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Available Tags</label>
                        <div className="flex flex-wrap gap-1.5">
                          {availableTags.map((t) => (
                            <button
                              key={t.tag}
                              type="button"
                              onClick={() => {
                                const tag = `{{${t.tag}}}`;
                                setCommunication((prev) => ({
                                  ...prev,
                                  greetingMessage: prev.greetingMessage + (prev.greetingMessage && !prev.greetingMessage.endsWith(' ') ? ' ' : '') + tag,
                                }));
                              }}
                              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 font-mono transition-colors"
                              title={`Insert ${t.label}`}
                            >
                              {`{{${t.tag}}}`}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Click a tag to insert it into the message</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-green-900 dark:text-green-300 mb-2">How it works</h4>
                    <ul className="text-xs text-green-800 dark:text-green-400 space-y-1.5">
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">1.</span>
                        <span>Lead submits the public form</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">2.</span>
                        <span>CRM creates the lead and assigns a telecaller</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">3.</span>
                        <span>Tags like {'{{name}}'} are replaced with the lead's form answers</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">4.</span>
                        <span>Personalized WhatsApp message is sent instantly</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Message Preview</h4>
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">WhatsApp Message</span>
                      </div>
                      <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {communication.greetingMessage
                          ? communication.greetingMessage
                              .replace(/\{\{name\}\}/g, 'John Doe')
                              .replace(/\{\{email\}\}/g, 'john@example.com')
                              .replace(/\{\{phone\}\}/g, '+91 98765 43210')
                              .replace(/\{\{(\w+)\}\}/g, (_, field) => `[${field}]`)
                          : 'Hi John Doe, thank you for your inquiry! We\'ll get back to you at john@example.com shortly.'}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : builderTab === 'page' ? (
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
          {/* Templates */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Quick Templates</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Start with a ready-made template to save time.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PAGE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setFields(tpl.fields as any);
                    setPageConfig((prev) => ({ ...prev, ...tpl.pageConfig }));
                    setSelectedFieldIndex(0);
                  }}
                  className="flex flex-col items-start gap-1.5 p-3 border border-gray-200 dark:border-gray-600 rounded-xl hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all text-left"
                >
                  <span className="text-2xl">{tpl.emoji}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tpl.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{tpl.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Theme & Style */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Theme & Style</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Customize the look of your public page.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={pageConfig.primaryColor} onChange={(e) => updatePageConfig({ primaryColor: e.target.value })} className="h-9 w-12 rounded border border-gray-300 dark:border-gray-600 p-0.5 cursor-pointer" />
                  <input type="text" value={pageConfig.primaryColor} onChange={(e) => updatePageConfig({ primaryColor: e.target.value })} className="flex-1 px-2.5 py-2 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 uppercase" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Secondary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={pageConfig.secondaryColor} onChange={(e) => updatePageConfig({ secondaryColor: e.target.value })} className="h-9 w-12 rounded border border-gray-300 dark:border-gray-600 p-0.5 cursor-pointer" />
                  <input type="text" value={pageConfig.secondaryColor} onChange={(e) => updatePageConfig({ secondaryColor: e.target.value })} className="flex-1 px-2.5 py-2 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 uppercase" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Background Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={pageConfig.backgroundColor} onChange={(e) => updatePageConfig({ backgroundColor: e.target.value })} className="h-9 w-12 rounded border border-gray-300 dark:border-gray-600 p-0.5 cursor-pointer" />
                  <input type="text" value={pageConfig.backgroundColor} onChange={(e) => updatePageConfig({ backgroundColor: e.target.value })} className="flex-1 px-2.5 py-2 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 uppercase" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Font Family</label>
                <select value={pageConfig.fontFamily} onChange={(e) => updatePageConfig({ fontFamily: e.target.value })} className="w-full px-2.5 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  {FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Border Radius</label>
                <div className="flex gap-2 flex-wrap">
                  {(['none', 'sm', 'md', 'lg', 'full'] as const).map((r) => (
                    <button key={r} type="button" onClick={() => updatePageConfig({ borderRadius: r })} className={`px-3 py-1.5 text-xs font-semibold rounded-md border capitalize ${pageConfig.borderRadius === r ? 'border-primary-400 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Background Image</label>
                {FORM_BG_PRESETS.length > 0 && (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => updatePageConfig({ backgroundImage: '' })}
                      className={`aspect-square rounded-lg border-2 flex items-center justify-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 ${!pageConfig.backgroundImage ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-900/50' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}
                      title="No background image"
                    >
                      None
                    </button>
                    {FORM_BG_PRESETS.map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => updatePageConfig({ backgroundImage: preset.url })}
                        className={`aspect-square rounded-lg overflow-hidden border-2 ${pageConfig.backgroundImage === preset.url ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-900/50' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}
                        title={preset.label}
                      >
                        <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
                <input type="url" value={pageConfig.backgroundImage} onChange={(e) => updatePageConfig({ backgroundImage: e.target.value })} placeholder="Or paste a custom image URL: https://example.com/bg.jpg" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
            </div>
          </div>

          {/* Header & Banner */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Header & Banner</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Add company branding at the top of the page.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Company Logo URL</label>
                <input type="url" value={pageConfig.companyLogo} onChange={(e) => updatePageConfig({ companyLogo: e.target.value })} placeholder="https://your-logo.png" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Banner Image URL <span className="text-gray-400 normal-case font-normal">(optional — replaces color header)</span></label>
                <input type="url" value={pageConfig.bannerImage} onChange={(e) => updatePageConfig({ bannerImage: e.target.value })} placeholder="https://banner-image.jpg" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
            </div>
          </div>

          {/* Page Sections */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Page Sections</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Toggle and configure sections shown on your public page.</p>
            <div className="space-y-4">
              {/* About */}
              <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">About Company</span>
                  <button type="button" onClick={() => updatePageConfig({ showAbout: !pageConfig.showAbout })} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pageConfig.showAbout ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${pageConfig.showAbout ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {pageConfig.showAbout && (
                  <div className="p-3 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Section Title</label>
                      <input value={pageConfig.aboutTitle} onChange={(e) => updatePageConfig({ aboutTitle: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Content</label>
                      <textarea value={pageConfig.aboutText} onChange={(e) => updatePageConfig({ aboutText: e.target.value })} rows={3} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" placeholder="Describe your company..." />
                    </div>
                  </div>
                )}
              </div>
              {/* Services */}
              <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Services / Products</span>
                  <button type="button" onClick={() => updatePageConfig({ showServices: !pageConfig.showServices })} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pageConfig.showServices ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${pageConfig.showServices ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {pageConfig.showServices && (
                  <div className="p-3 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Section Title</label>
                      <input value={pageConfig.servicesTitle} onChange={(e) => updatePageConfig({ servicesTitle: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                    </div>
                    {pageConfig.services.map((svc, si) => (
                      <div key={si} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-2">
                          <input value={svc.title} onChange={(e) => { const s = [...pageConfig.services]; s[si] = { ...s[si], title: e.target.value }; updatePageConfig({ services: s }); }} placeholder={`Service ${si + 1} title`} className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                          <textarea value={svc.description} onChange={(e) => { const s = [...pageConfig.services]; s[si] = { ...s[si], description: e.target.value }; updatePageConfig({ services: s }); }} placeholder="Description..." rows={2} className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none" />
                        </div>
                        <button type="button" onClick={() => updatePageConfig({ services: pageConfig.services.filter((_, i) => i !== si) })} className="p-1 text-red-400 hover:text-red-600 mt-1">✕</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => updatePageConfig({ services: [...pageConfig.services, { title: '', description: '' }] })} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Add service</button>
                  </div>
                )}
              </div>
              {/* Why Choose Us */}
              <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Why Choose Us</span>
                  <button type="button" onClick={() => updatePageConfig({ showWhyUs: !pageConfig.showWhyUs })} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pageConfig.showWhyUs ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${pageConfig.showWhyUs ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {pageConfig.showWhyUs && (
                  <div className="p-3 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Section Title</label>
                      <input value={pageConfig.whyUsTitle} onChange={(e) => updatePageConfig({ whyUsTitle: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                    </div>
                    {pageConfig.whyUsPoints.map((pt, pi) => (
                      <div key={pi} className="flex gap-2">
                        <input value={pt} onChange={(e) => { const pts = [...pageConfig.whyUsPoints]; pts[pi] = e.target.value; updatePageConfig({ whyUsPoints: pts }); }} placeholder={`Point ${pi + 1}`} className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                        <button type="button" onClick={() => updatePageConfig({ whyUsPoints: pageConfig.whyUsPoints.filter((_, i) => i !== pi) })} className="p-1 text-red-400 hover:text-red-600">✕</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => updatePageConfig({ whyUsPoints: [...pageConfig.whyUsPoints, ''] })} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Add point</button>
                  </div>
                )}
              </div>
              {/* Gallery */}
              <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Image Gallery</span>
                  <button type="button" onClick={() => updatePageConfig({ showGallery: !pageConfig.showGallery })} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pageConfig.showGallery ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${pageConfig.showGallery ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {pageConfig.showGallery && (
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Add up to 6 image URLs</p>
                    {pageConfig.galleryImages.slice(0, 6).map((img, gi) => (
                      <input key={gi} type="url" value={img} onChange={(e) => { const imgs = [...pageConfig.galleryImages]; imgs[gi] = e.target.value; updatePageConfig({ galleryImages: imgs }); }} placeholder={`Image ${gi + 1} URL`} className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                    ))}
                  </div>
                )}
              </div>
              {/* Contact Info */}
              <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Contact Information</span>
                  <button type="button" onClick={() => updatePageConfig({ showContact: !pageConfig.showContact })} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pageConfig.showContact ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${pageConfig.showContact ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {pageConfig.showContact && (
                  <div className="p-3 space-y-2">
                    <input value={pageConfig.contactPhone} onChange={(e) => updatePageConfig({ contactPhone: e.target.value })} placeholder="Phone number" className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                    <input value={pageConfig.contactEmail} onChange={(e) => updatePageConfig({ contactEmail: e.target.value })} placeholder="Email address" className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                    <input value={pageConfig.contactAddress} onChange={(e) => updatePageConfig({ contactAddress: e.target.value })} placeholder="Full address" className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                  </div>
                )}
              </div>
              {/* Google Map */}
              <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Google Map</span>
                  <button type="button" onClick={() => updatePageConfig({ showMap: !pageConfig.showMap })} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pageConfig.showMap ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${pageConfig.showMap ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {pageConfig.showMap && (
                  <div className="p-3">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Google Maps Embed URL <span className="font-normal">(paste the iframe src URL)</span></label>
                    <input value={pageConfig.mapEmbedUrl} onChange={(e) => updatePageConfig({ mapEmbedUrl: e.target.value })} placeholder="https://www.google.com/maps/embed?pb=..." className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Branding */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Branding</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Footer and company identity displayed on the page.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Company Name</label>
                <input value={pageConfig.companyName} onChange={(e) => updatePageConfig({ companyName: e.target.value })} placeholder="Your Company Name" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Footer Text</label>
                <input value={pageConfig.footerText} onChange={(e) => updatePageConfig({ footerText: e.target.value })} placeholder="© 2025 Your Company. All rights reserved." className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Privacy Policy URL</label>
                <input type="url" value={pageConfig.privacyUrl} onChange={(e) => updatePageConfig({ privacyUrl: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Terms & Conditions URL</label>
                <input type="url" value={pageConfig.termsUrl} onChange={(e) => updatePageConfig({ termsUrl: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
            </div>
          </div>

          {/* Thank You Page */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Thank You Page</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Shown after a successful form submission.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Title</label>
                <input value={pageConfig.thankYouTitle} onChange={(e) => updatePageConfig({ thankYouTitle: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Message</label>
                <textarea value={pageConfig.thankYouMessage} onChange={(e) => updatePageConfig({ thankYouMessage: e.target.value })} rows={3} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Contact Phone</label>
                  <input value={pageConfig.thankYouPhone} onChange={(e) => updatePageConfig({ thankYouPhone: e.target.value })} placeholder="+1 234 567 890" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Contact Email</label>
                  <input type="email" value={pageConfig.thankYouEmail} onChange={(e) => updatePageConfig({ thankYouEmail: e.target.value })} placeholder="hello@company.com" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Redirect URL <span className="text-gray-400 normal-case font-normal">(optional — redirects 3s after submission)</span></label>
                <input type="url" value={pageConfig.thankYouRedirectUrl} onChange={(e) => updatePageConfig({ thankYouRedirectUrl: e.target.value })} placeholder="https://your-website.com/thank-you" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
            </div>
          </div>

          {/* Floating Contact Buttons */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Floating Contact Buttons</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Sticky buttons shown on the bottom-right of the page.</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#25d366' }}>
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </span>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">WhatsApp</span>
                </div>
                <button type="button" onClick={() => updatePageConfig({ showWhatsapp: !pageConfig.showWhatsapp })} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pageConfig.showWhatsapp ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${pageConfig.showWhatsapp ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {pageConfig.showWhatsapp && (
                <input value={pageConfig.whatsappNumber} onChange={(e) => updatePageConfig({ whatsappNumber: e.target.value })} placeholder="Number with country code e.g. 919876543210" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              )}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  </span>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Call Button</span>
                </div>
                <button type="button" onClick={() => updatePageConfig({ showCall: !pageConfig.showCall })} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pageConfig.showCall ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${pageConfig.showCall ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {pageConfig.showCall && (
                <input value={pageConfig.callNumber} onChange={(e) => updatePageConfig({ callNumber: e.target.value })} placeholder="Phone number e.g. +919876543210" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              )}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </span>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Email Button</span>
                </div>
                <button type="button" onClick={() => updatePageConfig({ showEmail: !pageConfig.showEmail })} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pageConfig.showEmail ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${pageConfig.showEmail ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {pageConfig.showEmail && (
                <input type="email" value={pageConfig.contactEmailBtn} onChange={(e) => updatePageConfig({ contactEmailBtn: e.target.value })} placeholder="Email address" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              )}
            </div>
          </div>

          {/* SEO */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">SEO Settings</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Improve how search engines see your form page.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Meta Title</label>
                <input value={pageConfig.metaTitle} onChange={(e) => updatePageConfig({ metaTitle: e.target.value })} placeholder="Page title for search engines" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Meta Description</label>
                <textarea value={pageConfig.metaDescription} onChange={(e) => updatePageConfig({ metaDescription: e.target.value })} rows={2} placeholder="Brief description for search results (150–160 characters)" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Favicon URL</label>
                <input type="url" value={pageConfig.faviconUrl} onChange={(e) => updatePageConfig({ faviconUrl: e.target.value })} placeholder="https://your-favicon.ico" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Form Design Studio</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Tune layout, colors, and button style directly.</p>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Quick Tune</label>
                <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 p-3 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Layout</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setDesign((prev) => ({ ...prev, layout: 'centered' }))}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md border ${
                          design.layout === 'centered' ? 'border-primary-400 bg-primary-100 text-primary-700' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        Centered
                      </button>
                      <button
                        type="button"
                        onClick={() => setDesign((prev) => ({ ...prev, layout: 'split' }))}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md border ${
                          design.layout === 'split' ? 'border-primary-400 bg-primary-100 text-primary-700' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        Split
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Button</p>
                    <div className="flex flex-wrap gap-2">
                      {(['solid', 'gradient', 'outline'] as FormButtonStyle[]).map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => setDesign((prev) => ({ ...prev, buttonStyle: style }))}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md border capitalize ${
                            design.buttonStyle === style ? 'border-primary-400 bg-primary-100 text-primary-700' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="show-progress"
                      type="checkbox"
                      checked={design.showProgress}
                      onChange={(e) => setDesign((prev) => ({ ...prev, showProgress: e.target.checked }))}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                    <label htmlFor="show-progress" className="text-sm text-gray-700 dark:text-gray-300">Show progress bar</label>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Accent Color</p>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={normalizeHexColor(design.customColor) || '#0EA5E9'}
                          onChange={(e) => setDesign((prev) => ({ ...prev, customColor: e.target.value.toUpperCase() }))}
                          className="h-16 w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1 cursor-pointer"
                        />
                        <div className="grid grid-cols-2 gap-2 flex-1">
                          <input
                            type="text"
                            value={design.customColor}
                            onChange={(e) => setDesign((prev) => ({ ...prev, customColor: e.target.value }))}
                            onBlur={(e) => {
                              const normalized = normalizeHexColor(e.target.value);
                              setDesign((prev) => ({ ...prev, customColor: (normalized || prev.customColor).toUpperCase() }));
                            }}
                            className="col-span-2 px-2.5 py-1.5 text-xs font-semibold border border-gray-300 dark:border-gray-600 rounded-md uppercase bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            placeholder="#0EA5E9"
                          />
                          <input
                            type="number"
                            min={0}
                            max={255}
                            value={currentRgb.r}
                            onChange={(e) => setDesign((prev) => ({ ...prev, customColor: rgbToHex(Number(e.target.value), currentRgb.g, currentRgb.b) }))}
                            className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                          <input
                            type="number"
                            min={0}
                            max={255}
                            value={currentRgb.g}
                            onChange={(e) => setDesign((prev) => ({ ...prev, customColor: rgbToHex(currentRgb.r, Number(e.target.value), currentRgb.b) }))}
                            className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                          <input
                            type="number"
                            min={0}
                            max={255}
                            value={currentRgb.b}
                            onChange={(e) => setDesign((prev) => ({ ...prev, customColor: rgbToHex(currentRgb.r, currentRgb.g, Number(e.target.value)) }))}
                            className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const current = normalizeHexColor(design.customColor);
                              if (!current) return;
                              setCustomColorSlots((prev) => {
                                const next = [...prev];
                                const existing = next.findIndex((c) => c.toLowerCase() === current.toLowerCase());
                                if (existing >= 0) return next;
                                const emptyIndex = next.findIndex((c) => !c);
                                if (emptyIndex >= 0) {
                                  next[emptyIndex] = current.toUpperCase();
                                } else {
                                  next[next.length - 1] = current.toUpperCase();
                                }
                                return next;
                              });
                            }}
                            className="px-2.5 py-1.5 text-xs font-semibold border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Add to Custom
                          </button>
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Basic Colors</p>
                        <div className="grid grid-cols-12 gap-1.5">
                          {BASIC_COLORS.map((color) => {
                            const active = (normalizeHexColor(design.customColor) || '').toLowerCase() === color.toLowerCase();
                            return (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setDesign((prev) => ({ ...prev, customColor: color.toUpperCase() }))}
                                className={`h-5 w-5 rounded-full border ${active ? 'ring-2 ring-primary-400 border-primary-500' : 'border-black/10 hover:scale-105'}`}
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Custom Colors</p>
                        <div className="grid grid-cols-8 gap-1.5">
                          {customColorSlots.map((color, idx) => {
                            const active = color && (normalizeHexColor(design.customColor) || '').toLowerCase() === color.toLowerCase();
                            return color ? (
                              <button
                                key={`custom-${idx}`}
                                type="button"
                                onClick={() => setDesign((prev) => ({ ...prev, customColor: color }))}
                                className={`h-6 w-6 rounded-full border ${active ? 'ring-2 ring-primary-400 border-primary-500' : 'border-black/10 hover:scale-105'}`}
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ) : (
                              <span key={`empty-${idx}`} className="h-6 w-6 rounded-full border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Form Introduction</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm h-20 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="Short intro message shown above the public form"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Live Style Preview</h4>
            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-4 bg-gray-50 dark:bg-gray-900">
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 p-4">
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{title || 'Your Form Title'}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description || 'Your form intro will appear here.'}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Theme: {design.theme}</p>
                <div className="mt-4 h-2 w-32 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full w-1/2 bg-primary-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer removed — save/cancel moved to header */}
    </div>
  );
}
