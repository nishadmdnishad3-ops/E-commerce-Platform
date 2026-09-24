document.addEventListener("DOMContentLoaded", function () {
    const inputs = document.querySelectorAll(
        'input[type="file"].drag-drop-input'
    );

    inputs.forEach(function (input) {
        createDropZone(input);
    });
});


function createDropZone(input) {
    const wrapper = document.createElement("div");

    wrapper.className = "drag-drop-wrapper";

    wrapper.innerHTML = `
        <div class="drag-drop-zone">
            <div class="drag-drop-icon">📷</div>
            <div class="drag-drop-title">
                Drag & Drop Image Here
            </div>
            <div class="drag-drop-text">
                or click to choose a file
            </div>
            <div class="drag-drop-file-name"></div>
        </div>
    `;

    input.parentNode.insertBefore(wrapper, input);
    wrapper.querySelector(".drag-drop-zone").appendChild(input);

    const zone = wrapper.querySelector(".drag-drop-zone");
    const fileName = wrapper.querySelector(".drag-drop-file-name");

    zone.addEventListener("click", function () {
        input.click();
    });

    input.addEventListener("change", function () {
        if (input.files.length > 0) {
            fileName.textContent =
                "Selected: " + input.files[0].name;

            zone.classList.add("has-file");
        }
    });

    zone.addEventListener("dragover", function (event) {
        event.preventDefault();
        zone.classList.add("drag-over");
    });

    zone.addEventListener("dragleave", function () {
        zone.classList.remove("drag-over");
    });

    zone.addEventListener("drop", function (event) {
        event.preventDefault();

        zone.classList.remove("drag-over");

        const files = event.dataTransfer.files;

        if (files.length > 0) {
            input.files = files;

            fileName.textContent =
                "Selected: " + files[0].name;

            zone.classList.add("has-file");

            input.dispatchEvent(new Event("change", {
                bubbles: true
            }));
        }
    });
}