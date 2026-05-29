import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Download from "yet-another-react-lightbox/plugins/download";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import { Star, Link2Off, Copy } from "lucide-react";
import { toast } from "sonner";

export type LightboxItem = {
  linkId: string;
  src: string;
  alt: string;
  isMain: boolean;
};

export function AssetLightbox({
  items,
  index,
  onClose,
  onSetMain,
  onUnlink,
}: {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onSetMain: (linkId: string) => void;
  onUnlink: (linkId: string) => void;
}) {
  const open = index >= 0;
  const current = items[index];

  const copyUrl = async () => {
    if (!current) return;
    await navigator.clipboard.writeText(current.src);
    toast.success("تم نسخ رابط الصورة");
  };

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index < 0 ? 0 : index}
      slides={items.map((i) => ({
        src: i.src,
        alt: i.alt,
        download: { url: i.src, filename: i.alt },
      }))}
      plugins={[Zoom, Download, Counter]}
      zoom={{ maxZoomPixelRatio: 4, scrollToZoom: true }}
      counter={{ container: { style: { top: 0, bottom: "unset" } } }}
      toolbar={{
        buttons: [
          <button
            key="copy"
            type="button"
            className="yarl__button"
            title="نسخ الرابط"
            onClick={copyUrl}
          >
            <Copy className="size-5" />
          </button>,
          <button
            key="main"
            type="button"
            className="yarl__button"
            title="تعيين كصورة رئيسية"
            disabled={!current || current.isMain}
            onClick={() => current && onSetMain(current.linkId)}
          >
            <Star
              className={`size-5 ${current?.isMain ? "fill-yellow-400 text-yellow-400" : ""}`}
            />
          </button>,
          <button
            key="unlink"
            type="button"
            className="yarl__button"
            title="فك الربط"
            onClick={() => current && onUnlink(current.linkId)}
          >
            <Link2Off className="size-5" />
          </button>,
          "close",
        ],
      }}
      styles={{ container: { backgroundColor: "rgba(8, 12, 24, .92)" } }}
    />
  );
}
