interface Window {
  /**
   * The global dataLayer array for Google Tag Manager and Google Analytics.
   */
  dataLayer: IArguments[];

  /**
   * The global gtag function for Google Analytics.
   */
  gtag: (...args: IArguments[]) => void;
}
