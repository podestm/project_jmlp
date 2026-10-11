/**
 * Ostrov pro ještě nepřevedenou obrazovku uvnitř nového rámce: vykreslí staré
 * obaly, na kterých stojí staré CSS (ve vrstvě legacy), aby obrazovka vypadala
 * jako dnes.
 * - public: main-content > content-wrapper > row > col-lg-10 (fluid: jen main-content)
 * - admin: admin-layout-content s odsazením a container-fluid
 * - tk: timekeeper-section (pravidla časomíry v admin.css) s container-fluid
 *
 * Jediná komponenta kitu se třídami Bootstrapu – check:styles ji má jako
 * výjimku. Na předcích ostrova nesmí být transform, filter, backdrop-filter,
 * contain ani will-change (rozbily by position:fixed starých modalů).
 * Smaže se ve Fázi 6 spolu se starým CSS.
 */
export default function LegacyIsland({ variant, fluid = false, children }) {
  if (variant === 'public') {
    if (fluid) return <div className="main-content">{children}</div>;
    return (
      <div className="main-content">
        <div className="content-wrapper">
          <div className="row justify-content-center">
            <div className="col-lg-10">{children}</div>
          </div>
        </div>
      </div>
    );
  }
  if (variant === 'admin') {
    return (
      <div className="admin-layout-content p-4">
        <div className="container-fluid">{children}</div>
      </div>
    );
  }
  if (variant === 'tk') {
    return (
      <div className="timekeeper-section p-4">
        <div className="container-fluid">{children}</div>
      </div>
    );
  }
  throw new Error(`LegacyIsland: neznámá varianta „${variant}“`);
}
