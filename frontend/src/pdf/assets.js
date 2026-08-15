/**
 * Loga do hlavičky výsledkové listiny.
 *
 * pdfmake potřebuje obrázky jako data URI, ne jako URL. Načtou se jednou
 * a zůstanou v paměti; soubory samotné jsou součástí buildu, takže je
 * service worker má nakešované i pro offline tisk.
 *
 * Vlevo je logo pořádajícího klubu (nahrává se v Admin → Kluby), vpravo logo
 * Svazu lyžařů. Když klub logo nemá, vlevo se použije logo JMLP.
 */
import jmlpLogo from '../assets/images/jmlp_logo.png';
import svazLogo from '../assets/images/czech_ski_snowboard-logo.png';

const cache = new Map();

const toDataUrl = async (url) => {
  if (cache.has(url)) return cache.get(url);

  const promise = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Logo se nepodařilo načíst: ${url}`);
      return response.blob();
    })
    .then((blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }))
    .catch(() => null);   // bez loga se listina vytiskne taky

  cache.set(url, promise);
  return promise;
};

/**
 * Loga pro hlavičku.
 * @param {string?} organizerLogoUrl  URL loga pořádajícího klubu z API
 */
export async function loadHeaderLogos(organizerLogoUrl) {
  const [organizer, jmlp, svaz] = await Promise.all([
    organizerLogoUrl ? toDataUrl(organizerLogoUrl) : Promise.resolve(null),
    toDataUrl(jmlpLogo),
    toDataUrl(svazLogo)
  ]);

  return {
    leftLogo: organizer || jmlp,
    rightLogo: svaz
  };
}
