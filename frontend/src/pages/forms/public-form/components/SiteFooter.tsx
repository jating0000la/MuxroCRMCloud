interface SiteFooterProps {
  footerText: string;
  companyName: string;
  privacyUrl: string;
  termsUrl: string;
}

export default function SiteFooter({ footerText, companyName, privacyUrl, termsUrl }: SiteFooterProps) {
  return (
    <footer className="py-8 px-4 border-t border-gray-200/60">
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-sm text-gray-500">{footerText || `© ${new Date().getFullYear()} ${companyName}. All rights reserved.`}</p>
        {(privacyUrl || termsUrl) && (
          <div className="flex items-center justify-center gap-6 mt-3">
            {privacyUrl && (
              <a href={privacyUrl} className="text-xs text-gray-400 hover:underline" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
            )}
            {termsUrl && (
              <a href={termsUrl} className="text-xs text-gray-400 hover:underline" target="_blank" rel="noopener noreferrer">
                Terms &amp; Conditions
              </a>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
