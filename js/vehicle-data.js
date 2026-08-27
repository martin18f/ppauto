(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.ppVehicleData = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LEGACY_CHOICE_SEPARATOR = /\s*(?:\+|\/|,|;|\u2022|\u00b7)\s*/u;

  function clean(value) {
    return String(value ?? '').trim();
  }

  function toChoiceList(value) {
    const result = [];

    function append(raw) {
      if (Array.isArray(raw)) {
        raw.forEach(append);
        return;
      }

      if (typeof raw !== 'string' && typeof raw !== 'number') return;

      clean(raw).split(LEGACY_CHOICE_SEPARATOR).forEach(part => {
        const item = clean(part);
        if (!item) return;

        const duplicate = result.some(existing => (
          existing.localeCompare(item, 'sk', { sensitivity: 'accent' }) === 0
        ));
        if (!duplicate) result.push(item);
      });
    }

    append(value);
    return result;
  }

  function formatChoices(value, separator = ' ') {
    return toChoiceList(value).join(clean(separator) || ' ');
  }

  function fuelValues(carOrValue) {
    const value = carOrValue && typeof carOrValue === 'object' && !Array.isArray(carOrValue)
      ? carOrValue.palivo
      : carOrValue;
    return toChoiceList(value);
  }

  function formatFuel(carOrValue) {
    return fuelValues(carOrValue).join(' ');
  }

  function vehicleImages(car) {
    if (!car || typeof car !== 'object' || Array.isArray(car)) return [];

    const gallery = Array.isArray(car.galeria) && car.galeria.length
      ? car.galeria
      : (Array.isArray(car.obrazky) ? car.obrazky : []);
    const cover = clean(car.titulka || car.obrazok);
    const images = [];

    [cover, ...gallery].forEach(raw => {
      const url = clean(raw);
      if (!url || images.includes(url)) return;
      images.push(url);
    });

    return images;
  }

  function primaryImage(car) {
    return vehicleImages(car)[0] || '';
  }

  return Object.freeze({
    toChoiceList,
    formatChoices,
    fuelValues,
    formatFuel,
    vehicleImages,
    primaryImage,
  });
});
