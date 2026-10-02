/**
 * Obrázky do hlavičky a patičky listin.
 *
 * pdfmake potřebuje obrázky jako data URI, ne jako URL. Načtou se jednou
 * a zůstanou v paměti; soubory z buildu má service worker nakešované i pro
 * offline tisk.
 *
 * Vlevo je logo pořádajícího klubu (nahrává se v Admin → Kluby), vpravo logo
 * Svazu lyžařů. Když klub logo nemá, vlevo se použije logo JMLP. Pod
 * výsledkovou listinou je pruh sponzorů nahraný u závodu.
 *
 * Každý obrázek se vrací i s rozměry - listina ho vepisuje do šířky rámečku
 * se zachováním poměru stran, stejně jako LiZa.
 */
import jmlpLogo from '../assets/images/jmlp_logo.png';
import svazLogo from '../assets/images/czech_ski_snowboard-logo.png';

const cache = new Map();

const measure = (dataUrl) => new Promise((resolve) => {
  if (typeof Image === 'undefined') {
    resolve({ dataUrl, width: null, height: null });
    return;
  }
  const image = new Image();
  image.onload = () => resolve({ dataUrl, width: image.naturalWidth, height: image.naturalHeight });
  image.onerror = () => resolve({ dataUrl, width: null, height: null });
  image.src = dataUrl;
});

/** Obrázek z URL jako { dataUrl, width, height }; null když se načíst nepovede. */
export const loadImage = async (url) => {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url);

  const promise = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Obrázek se nepodařilo načíst: ${url}`);
      return response.blob();
    })
    .then((blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }))
    .then(measure)
    .catch(() => null);   // bez obrázku se listina vytiskne taky

  cache.set(url, promise);
  return promise;
};

/**
 * Loga pro hlavičku a pruh sponzorů.
 * @param {string?} organizerLogoUrl  URL loga pořádajícího klubu z API
 * @param {string?} sponsorsUrl       URL obrázku sponzorů závodu z API
 */
export async function loadHeaderLogos(organizerLogoUrl, sponsorsUrl = null) {
  const [organizer, jmlp, svaz, sponsors] = await Promise.all([
    loadImage(organizerLogoUrl),
    loadImage(jmlpLogo),
    loadImage(svazLogo),
    loadImage(sponsorsUrl)
  ]);

  return {
    leftLogo: organizer || jmlp,
    rightLogo: svaz,
    sponsors
  };
}
