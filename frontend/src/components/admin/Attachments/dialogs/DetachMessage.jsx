import FileInfo from '../../shared/FileInfo/FileInfo.jsx';
import styles from './DetachMessage.module.css';

/** Tělo dialogu odpojení: karta souboru a co znamenají obě volby. */
export default function DetachMessage({ attachment }) {
  return (
    <div className={styles.body}>
      <p className={styles.text}>Soubor přestane být u této položky zveřejněný.</p>
      <div className={styles.card}>
        <FileInfo file={attachment} />
      </div>
      <p className={styles.text}>
        <strong>Odpojit, soubor ponechat</strong> odebere soubor jen tady.{' '}
        <strong>Odpojit a smazat soubor</strong> ho smaže úplně – zmizí ze všech míst a vrátit to nejde.
      </p>
    </div>
  );
}
