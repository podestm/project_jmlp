from app.services.library_export import zip_folder_for, zip_entry_names


def test_zip_folder_per_owner_type():
    assert zip_folder_for("race") == "zavody"
    assert zip_folder_for("season") == "sezony"
    assert zip_folder_for("club") == "kluby"
    assert zip_folder_for("post") == "clanky"
    assert zip_folder_for("library") == "nezarazene"
    assert zip_folder_for(None) == "nezarazene"


def test_entry_names_use_first_owner():
    files = [
        {
            "id": 1,
            "original_filename": "JMLP2025-05_propozice.pdf",
            "usage_info": [{"owner_type": "race"}, {"owner_type": "season"}],
        },
    ]
    assert zip_entry_names(files) == {1: "zavody/JMLP2025-05_propozice.pdf"}


def test_entry_names_put_unattached_in_nezarazene():
    files = [{"id": 2, "original_filename": "Jmlp.jpg", "usage_info": []}]
    assert zip_entry_names(files) == {2: "nezarazene/Jmlp.jpg"}


def test_entry_names_deduplicate_within_folder():
    files = [
        {"id": 1, "original_filename": "stejny.pdf", "usage_info": []},
        {"id": 2, "original_filename": "stejny.pdf", "usage_info": []},
    ]
    names = zip_entry_names(files)
    assert names[1] == "nezarazene/stejny.pdf"
    assert names[2] == "nezarazene/stejny-2.pdf"
