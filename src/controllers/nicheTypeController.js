const OrgNicheType = require('../models/OrgNicheType');

exports.listNicheTypes = async (req, res) => {
  try {
    const filter = {};
    if (req.query.activeOnly === 'true') {
      filter.isActive = true;
    }
    const niches = await OrgNicheType.find(filter).sort({ name: 1 });
    res.json(niches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createNicheType = async (req, res) => {
  try {
    const newNiche = new OrgNicheType({
      ...req.body,
      createdByUserId: req.user.id
    });
    const savedNiche = await newNiche.save();
    res.status(201).json(savedNiche);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateNicheType = async (req, res) => {
  try {
    const { key } = req.params;
    // key is immutable, so we find by key and update other fields
    const updatedNiche = await OrgNicheType.findOneAndUpdate(
      { key },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!updatedNiche) {
      return res.status(404).json({ message: 'Niche type not found' });
    }
    res.json(updatedNiche);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.toggleNicheStatus = async (req, res) => {
  try {
    const { key } = req.params;
    const niche = await OrgNicheType.findOne({ key });
    if (!niche) {
      return res.status(404).json({ message: 'Niche type not found' });
    }
    niche.isActive = !niche.isActive;
    await niche.save();
    res.json(niche);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
