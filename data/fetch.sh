#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${BASE_DIR:-gesetze-xml}"

if [[ "$BASE_DIR" != "." ]]; then
  mkdir -p -- "$BASE_DIR"
  cd -- "$BASE_DIR"
fi

# Note: BDSG slug is bdsg_2018
SLUGS=(gg bgb stgb stpo zpo hgb ao_1977 vwvfg vwgo bdsg_2018)
NAMES=(
  "Grundgesetz"
  "Bürgerliches Gesetzbuch (BGB)"
  "Strafgesetzbuch (StGB)"
  "Strafprozessordnung (StPO)"
  "Zivilprozessordnung (ZPO)"
  "Handelsgesetzbuch (HGB)"
  "Abgabenordnung (AO)"
  "Verwaltungsverfahrensgesetz (VwVfG)"
  "Verwaltungsgerichtsordnung (VwGO)"
  "Bundesdatenschutzgesetz (BDSG)"
)

sanitize_dirname() {
  local s="$1"
  s="${s//\//-}"     # replace slashes
  s="${s// /_}"      # spaces → underscores
  printf '%s' "$s"
}

folder_from_name() {
  local name="$1"
  # Use short form in the last parentheses if present, else sanitized full name
  if [[ "$name" =~ \(([^()]*)\)$ ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
  else
    sanitize_dirname "$name"
  fi
}

fetch_one() {
  local slug="$1" name="$2"
  local dir; dir="$(folder_from_name "$name")"

  echo "▶ $name [$slug] → $dir/"
  mkdir -p -- "$dir"

  local url="https://www.gesetze-im-internet.de/${slug}/xml.zip"
  local zip="${dir}/${slug}.zip"

  if ! curl -fL "$url" -o "$zip"; then
    echo "   ⚠️  Failed to download: $url" >&2
    return 1
  fi

  unzip -oq "$zip" -d "$dir"

  if [[ -f "${dir}/index.xml" ]]; then
    mv -f -- "${dir}/index.xml" "${dir}/${slug}.xml"
  fi

  {
    echo "name: $name"
    echo "slug: $slug"
    echo "source: $url"
    echo "downloaded_at: $(date -Iseconds)"
  } > "${dir}/MANIFEST.txt"

  ls -1 "$dir"
}

for i in "${!SLUGS[@]}"; do
  fetch_one "${SLUGS[$i]}" "${NAMES[$i]}"
done

echo
echo "✅ Done. Output in: $(pwd)"
