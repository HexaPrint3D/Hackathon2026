import json

from app import DEFAULT_DATA_DIR, load_app_data


def main() -> None:
    items, _ = load_app_data()
    output = []
    for item in items:
        output.append(
            {
                key: item.get(key)
                for key in (
                    "id",
                    "kind",
                    "kind_label",
                    "source",
                    "title",
                    "subtitle",
                    "lat",
                    "lon",
                    "details",
                    "geometry_type",
                    "geometry",
                    "search_blob",
                    "search_words",
                    "geocode_query",
                )
            }
        )
    with open("data.json", "w", encoding="utf-8") as handle:
        json.dump(
            {"defaultCenter": {"lat": 48.3069, "lon": 14.2858}, "dataDir": str(DEFAULT_DATA_DIR), "items": output},
            handle,
            ensure_ascii=False,
            separators=(",", ":"),
        )
    print(f"Exportiert: {len(output)} Datensätze")


if __name__ == "__main__":
    main()
