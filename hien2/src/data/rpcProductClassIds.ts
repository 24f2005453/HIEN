const RPC_CLASS_IDS = [
  112, 111, 103, 87, 92, 172, 120, 177, 72, 148, 70, 194, 158, 63, 62, 2, 141, 153, 168, 99,
  167, 118, 58, 59, 165, 182, 90, 164, 24, 15, 25, 28, 18, 156, 157, 16, 105, 27, 14, 17, 23, 21,
  20, 106, 107, 97, 98, 3, 1, 12, 8, 143, 142, 147, 145, 162, 69, 108, 155, 32, 31, 175,
  187, 150, 126, 123, 130, 129, 132, 133, 124, 122, 119, 45, 180, 47, 51, 48, 49, 159, 170,
  169, 86, 67, 6, 71, 84, 171, 43, 44, 42, 154, 193, 186, 184, 191, 179, 38, 178, 192, 57,
  56, 151, 140, 144, 110, 181, 30, 29, 134, 10, 11, 5, 166, 75, 163, 4, 33, 34, 115, 117,
  109, 114, 113, 116, 73, 78, 82, 74, 77, 76, 160, 195, 101, 152, 198, 26, 88, 52, 199,
  22, 104, 128, 127, 183, 80, 91, 94, 93, 37, 196, 185, 79, 61, 60, 176, 41, 136, 138,
  137, 139, 68, 83, 35, 100, 95, 66, 65, 121, 54, 50, 19, 102, 149, 146, 161, 189, 125,
  131, 64, 53, 46, 85, 174, 190, 55, 135, 39, 81, 200, 7, 9, 197, 89, 36, 13, 173, 96,
  40, 188
];

const categoryForRpcId = (id: number): string => {
  if (id <= 14) return "puffed_food";
  if (id <= 23) return "dried_fruit";
  if (id <= 30) return "dried_food";
  if (id <= 41) return "instant_drink";
  if (id <= 53) return "instant_noodles";
  if (id <= 69) return "dessert";
  if (id <= 87) return "drink";
  if (id <= 96) return "alcohol";
  if (id <= 107) return "milk";
  if (id <= 121) return "canned_food";
  if (id <= 133) return "chocolate";
  if (id <= 141) return "gum";
  if (id <= 151) return "candy";
  if (id <= 163) return "seasoner";
  if (id <= 173) return "personal_hygiene";
  if (id <= 193) return "tissue";
  return "stationery";
};

if (
  RPC_CLASS_IDS.length !== 200 ||
  new Set(RPC_CLASS_IDS).size !== 200 ||
  !RPC_CLASS_IDS.every((id) => id >= 1 && id <= 200)
) {
  throw new Error("RPC product class IDs must contain each of the 200 dataset classes exactly once.");
}

export const RPC_PRODUCT_CLASS_LABELS = RPC_CLASS_IDS.map(
  (id) => `${id}_${categoryForRpcId(id)}`
);
