import { useParams } from 'react-router-dom';
import { readBranding } from '../../utils/branding';
import { usePublicForm } from './public-form/hooks/usePublicForm';
import { useSeoAndTheme } from './public-form/hooks/useSeoAndTheme';
import { BORDER_RADIUS_MAP, FONT_FAMILY_MAP, TRUST_BADGES } from './public-form/constants';
import { LoadingScreen, ErrorScreen } from './public-form/components/StatusScreens';
import ThankYouView from './public-form/components/ThankYouView';
import StickyHeader from './public-form/components/StickyHeader';
import HeroSection from './public-form/components/HeroSection';
import { AboutSection, GallerySection, ServicesSection, WhyUsSection } from './public-form/components/MarketingSections';
import FormCard from './public-form/components/FormCard';
import ContactMapSection from './public-form/components/ContactMapSection';
import SiteFooter from './public-form/components/SiteFooter';
import FloatingContactFab from './public-form/components/FloatingContactFab';
import LogoImage from './public-form/components/LogoImage';

const FORM_ANCHOR_ID = 'public-form';

export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const branding = readBranding();
  const {
    form,
    fields,
    design,
    description,
    pageConfig,
    formData,
    errors,
    loading,
    submitting,
    submitted,
    loadError,
    progress,
    handleChange,
    handleSubmit,
    resetForm,
  } = usePublicForm(slug);

  useSeoAndTheme(form, branding);

  if (loading) return <LoadingScreen />;
  if (loadError) return <ErrorScreen message={loadError} />;

  const displayLogo = branding.appLogoUrl;
  const displayCompanyName = pageConfig.companyName || branding.appName;
  const primaryColor = pageConfig.primaryColor !== '#0ea5e9' ? pageConfig.primaryColor : design.customColor || pageConfig.primaryColor;
  const cardRadius = BORDER_RADIUS_MAP[pageConfig.borderRadius] || '12px';
  const btnRadius = pageConfig.borderRadius === 'full' ? '9999px' : BORDER_RADIUS_MAP[pageConfig.borderRadius] || '12px';

  if (submitted) {
    return <ThankYouView pageConfig={pageConfig} companyName={displayCompanyName} onReset={resetForm} />;
  }

  const hasAnySections = pageConfig.showAbout || pageConfig.showServices || pageConfig.showWhyUs || pageConfig.showGallery;
  const isSplit = design.layout === 'split';

  const pageStyle = {
    fontFamily: FONT_FAMILY_MAP[pageConfig.fontFamily] || FONT_FAMILY_MAP.system,
    ...(pageConfig.backgroundImage && /^https?:\/\//.test(pageConfig.backgroundImage)
      ? { backgroundImage: `url('${pageConfig.backgroundImage}')`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' as const }
      : { backgroundColor: pageConfig.backgroundColor }),
  };

  return (
    <div style={pageStyle} className="min-h-screen">
      <FloatingContactFab pageConfig={pageConfig} primaryColor={primaryColor} />

      <StickyHeader
        logo={displayLogo}
        companyName={displayCompanyName}
        primaryColor={primaryColor}
        secondaryColor={pageConfig.secondaryColor}
        showProgress={design.showProgress && fields.length > 0}
        progress={progress}
      />

      {pageConfig.bannerImage && (
        <div className="w-full overflow-hidden shadow-md" style={{ height: 220 }}>
          <img src={pageConfig.bannerImage} alt="Banner" className="w-full h-full object-cover" />
        </div>
      )}

      {!isSplit && (
        <HeroSection
          logo={displayLogo}
          companyName={displayCompanyName}
          title={form?.title || ''}
          description={description}
          primaryColor={primaryColor}
          secondaryColor={pageConfig.secondaryColor}
          bannerImage={pageConfig.bannerImage}
          showScrollCta={hasAnySections}
          formAnchorId={FORM_ANCHOR_ID}
        />
      )}

      <AboutSection title={pageConfig.aboutTitle} text={pageConfig.showAbout ? pageConfig.aboutText : ''} primaryColor={primaryColor} cardRadius={cardRadius} />
      <ServicesSection title={pageConfig.servicesTitle} services={pageConfig.showServices ? pageConfig.services : []} primaryColor={primaryColor} cardRadius={cardRadius} />
      <WhyUsSection title={pageConfig.whyUsTitle} points={pageConfig.showWhyUs ? pageConfig.whyUsPoints : []} primaryColor={primaryColor} secondaryColor={pageConfig.secondaryColor} />
      <GallerySection images={pageConfig.showGallery ? pageConfig.galleryImages : []} primaryColor={primaryColor} cardRadius={cardRadius} />

      <section id={FORM_ANCHOR_ID} className="py-10 px-4 scroll-mt-20">
        {isSplit ? (
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8">
            <aside
              className="lg:col-span-2 p-7 shadow-lg h-fit"
              style={{ borderRadius: cardRadius, background: `linear-gradient(135deg, ${primaryColor}, ${pageConfig.secondaryColor})` }}
            >
              {displayLogo && (
                <div className="mb-4 flex justify-center">
                  <LogoImage src={displayLogo} alt="Logo" size={56} />
                </div>
              )}
              <h2 className="text-2xl font-bold text-white mb-2">{form?.title}</h2>
              <p className="text-white/80 text-sm leading-relaxed mb-6">{description || 'Please share your details. Our team will get in touch soon.'}</p>
              <div className="space-y-3">
                {TRUST_BADGES.map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                    <span className="text-white/90 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </aside>
            <div className="lg:col-span-3">
              <FormCard
                fields={fields}
                formData={formData}
                errors={errors}
                primaryColor={primaryColor}
                secondaryColor={pageConfig.secondaryColor}
                cardRadius={cardRadius}
                btnRadius={btnRadius}
                submitting={submitting}
                onChange={handleChange}
                onSubmit={handleSubmit}
              />
            </div>
          </div>
        ) : (
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Get in Touch</h2>
              <div className="w-14 h-1 rounded mx-auto mt-3" style={{ backgroundColor: primaryColor }} />
            </div>
            <FormCard
              fields={fields}
              formData={formData}
              errors={errors}
              primaryColor={primaryColor}
              secondaryColor={pageConfig.secondaryColor}
              cardRadius={cardRadius}
              btnRadius={btnRadius}
              submitting={submitting}
              onChange={handleChange}
              onSubmit={handleSubmit}
            />
          </div>
        )}
      </section>

      <ContactMapSection pageConfig={pageConfig} primaryColor={primaryColor} cardRadius={cardRadius} />

      <SiteFooter footerText={pageConfig.footerText} companyName={displayCompanyName} privacyUrl={pageConfig.privacyUrl} termsUrl={pageConfig.termsUrl} />
    </div>
  );
}
