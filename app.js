firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const DEFAULT_IMAGE = "./images/no-image.webp";

const itemsList = document.getElementById("items-list");
const btnAddItem = document.getElementById("btnAddItem");
const btnConfirmGift = document.getElementById("btnConfirmGift");
const newItemPhoto = document.getElementById("newItemPhoto");
const photoPreview = document.getElementById("photoPreview");

let pendingGiftItemId = null;
let pendingGiftPersonName = null;
let selectedPhotoBase64 = null;

function renderItem(item, id) {
  var isBought = item.bought === true;
  var col = document.createElement("div");
  col.className = "col-sm-6 col-md-4 col-lg-3";
  col.id = "item-" + id;

  col.innerHTML =
    '<div class="card h-100 shadow-sm ' + (isBought ? "card-bought" : "") + '">' +
      '<img src="' + (item.photo || DEFAULT_IMAGE) + '" class="card-img-top item-photo" alt="' + item.name + '" onerror="this.src=\'' + DEFAULT_IMAGE + '\'">' +
      '<div class="card-body d-flex flex-column">' +
        '<h5 class="card-title text-center">' + item.name + '</h5>' +
        (isBought
          ? '<div class="mt-auto text-center">' +
              '<span class="badge bg-success fs-6 badge-wrap"><i class="bi bi-check-circle me-1"></i>Presenteado por ' + item.boughtBy + '</span>' +
            '</div>'
          : '<div class="mt-auto">' +
              '<input type="text" class="form-control mb-2" placeholder="Seu nome (opcional)" id="input-' + id + '">' +
              '<button class="btn btn-pink w-100" onclick="handleGift(\'' + id + '\', \'' + item.name.replace(/'/g, "\\'") + '\')">' +
                '<i class="bi bi-gift me-1"></i>Presentear' +
              '</button>' +
            '</div>'
        ) +
      '</div>' +
    '</div>';

  return col;
}

function loadItems() {
  itemsList.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-pink" role="status"></div><p class="mt-2 text-muted">Carregando itens...</p></div>';

  db.collection("items").onSnapshot(function (snapshot) {
    itemsList.innerHTML = "";
    var items = [];
    snapshot.forEach(function (docSnap) {
      var data = docSnap.data();
      items.push({ data: data, id: docSnap.id });
    });
    items.sort(function (a, b) {
      var aBought = a.data.boughtBy ? 1 : 0;
      var bBought = b.data.boughtBy ? 1 : 0;
      if (aBought !== bBought) return aBought - bBought;
      var aTime = a.data.createdAt ? (a.data.createdAt.toMillis ? a.data.createdAt.toMillis() : new Date(a.data.createdAt).getTime()) : 0;
      var bTime = b.data.createdAt ? (b.data.createdAt.toMillis ? b.data.createdAt.toMillis() : new Date(b.data.createdAt).getTime()) : 0;
      return aTime - bTime;
    });
    items.forEach(function (item) {
      var el = renderItem(item.data, item.id);
      itemsList.appendChild(el);
    });
    if (items.length === 0) {
      itemsList.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">Nenhum item encontrado. Adicione o primeiro item!</p></div>';
    }
  }, function (error) {
    console.error("Erro ao carregar itens:", error);
    itemsList.innerHTML = '<div class="col-12 text-center py-5"><p class="text-danger">Erro ao carregar itens: ' + error.message + '</p></div>';
  });
}

function handleGift(itemId, itemName) {
  var input = document.getElementById("input-" + itemId);
  var personName = input.value.trim();
  pendingGiftItemId = itemId;
  pendingGiftPersonName = personName || "Anônimo";
  document.getElementById("confirmItemName").textContent = itemName;
  var modal = new bootstrap.Modal(document.getElementById("confirmModal"));
  modal.show();
}

btnConfirmGift.addEventListener("click", function () {
  if (!pendingGiftItemId) return;
  db.collection("items").doc(pendingGiftItemId).update({
    bought: true,
    boughtBy: pendingGiftPersonName,
  }).then(function () {
    bootstrap.Modal.getInstance(document.getElementById("confirmModal")).hide();
  }).catch(function (err) {
    alert("Erro ao confirmar presente. Tente novamente.");
    console.error(err);
  });
  pendingGiftItemId = null;
  pendingGiftPersonName = null;
});

function resizeImage(file, maxWidth, maxHeight, callback) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement("canvas");
      var w = img.width;
      var h = img.height;
      if (w > maxWidth || h > maxHeight) {
        var ratio = Math.min(maxWidth / w, maxHeight / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

newItemPhoto.addEventListener("change", function () {
  var file = newItemPhoto.files[0];
  if (file) {
    resizeImage(file, 400, 300, function (base64) {
      selectedPhotoBase64 = base64;
      photoPreview.classList.remove("d-none");
      photoPreview.querySelector("img").src = base64;
    });
  } else {
    selectedPhotoBase64 = null;
    photoPreview.classList.add("d-none");
  }
});

btnAddItem.addEventListener("click", function () {
  var name = document.getElementById("newItemName").value.trim();

  if (!name) {
    document.getElementById("newItemName").classList.add("is-invalid");
    return;
  }

  btnAddItem.disabled = true;
  btnAddItem.textContent = "Adicionando...";

  db.collection("items").add({
    name: name,
    photo: selectedPhotoBase64 || "",
    bought: false,
    boughtBy: "",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).then(function () {
    document.getElementById("newItemName").value = "";
    document.getElementById("newItemName").classList.remove("is-invalid");
    newItemPhoto.value = "";
    selectedPhotoBase64 = null;
    photoPreview.classList.add("d-none");
    btnAddItem.disabled = false;
    btnAddItem.textContent = "Adicionar";
    var modalEl = document.getElementById("addItemModal");
    var modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modalInstance.hide();
  }).catch(function (err) {
    alert("Erro ao adicionar item. Tente novamente.");
    console.error(err);
    btnAddItem.disabled = false;
    btnAddItem.textContent = "Adicionar";
  });
});

loadItems();
