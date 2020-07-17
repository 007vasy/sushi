import { FSHTank, FSHDocument } from '../../src/import';
import {
  Profile,
  Extension,
  FshValueSet,
  Instance,
  FshCodeSystem,
  Invariant,
  FshCode,
  RuleSet,
  Mapping
} from '../../src/fshtypes';
import { Type, Metadata } from '../../src/utils/Fishable';
import { minimalConfig } from '../utils/minimalConfig';
import { CaretValueRule } from '../../src/fshtypes/rules';

describe('FSHTank', () => {
  let tank: FSHTank;
  beforeEach(() => {
    const doc1 = new FSHDocument('doc1.fsh');
    doc1.aliases.set('FOO', 'http://foo.com');
    doc1.profiles.set('Profile1', new Profile('Profile1'));
    doc1.profiles.get('Profile1').id = 'prf1';
    doc1.profiles.get('Profile1').parent = 'Observation';
    doc1.profiles.set('Profile2', new Profile('Profile2'));
    doc1.profiles.get('Profile2').id = 'prf2';
    doc1.profiles.get('Profile2').parent = 'Observation';
    doc1.extensions.set('Extension1', new Extension('Extension1'));
    doc1.extensions.get('Extension1').id = 'ext1';
    doc1.extensions.get('Extension1').parent = 'Extension2';
    const doc2 = new FSHDocument('doc2.fsh');
    doc2.aliases.set('BAR', 'http://bar.com');
    doc2.extensions.set('Extension2', new Extension('Extension2'));
    doc2.extensions.get('Extension2').id = 'ext2';
    doc2.valueSets.set('ValueSet1', new FshValueSet('ValueSet1'));
    doc2.valueSets.get('ValueSet1').id = 'vs1';
    doc2.codeSystems.set('CodeSystem1', new FshCodeSystem('CodeSystem1'));
    doc2.codeSystems.get('CodeSystem1').id = 'cs1';
    const doc3 = new FSHDocument('doc3.fsh');
    doc3.valueSets.set('ValueSet2', new FshValueSet('ValueSet2'));
    doc3.valueSets.get('ValueSet2').id = 'vs2';
    doc3.codeSystems.set('CodeSystem2', new FshCodeSystem('CodeSystem2'));
    doc3.codeSystems.get('CodeSystem2').id = 'cs2';
    doc3.instances.set('Instance1', new Instance('Instance1'));
    doc3.instances.get('Instance1').id = 'inst1';
    doc3.instances.get('Instance1').instanceOf = 'Condition';
    doc3.invariants.set('Invariant1', new Invariant('Invariant1'));
    doc3.invariants.get('Invariant1').description = 'first invariant';
    doc3.invariants.get('Invariant1').severity = new FshCode('error');
    doc3.ruleSets.set('RuleSet1', new RuleSet('RuleSet1'));
    doc3.mappings.set('Mapping1', new Mapping('Mapping1'));
    doc3.mappings.get('Mapping1').id = 'map1';

    tank = new FSHTank([doc1, doc2, doc3], minimalConfig);
  });

  describe('#fish', () => {
    it('should find valid fish when fishing by id for all types', () => {
      expect(tank.fish('prf1').name).toBe('Profile1');
      expect(tank.fish('ext1').name).toBe('Extension1');
      expect(tank.fish('vs1').name).toBe('ValueSet1');
      expect(tank.fish('cs1').name).toBe('CodeSystem1');
      expect(tank.fish('inst1').name).toBe('Instance1');
      // not applicable for Invariant or RuleSet or Mapping
    });

    it('should find valid fish when fishing by name for all types', () => {
      expect(tank.fish('Profile2').id).toBe('prf2');
      expect(tank.fish('Extension2').id).toBe('ext2');
      expect(tank.fish('ValueSet2').id).toBe('vs2');
      expect(tank.fish('CodeSystem2').id).toBe('cs2');
      expect(tank.fish('Instance1').id).toBe('inst1');
      expect(tank.fish('Invariant1').name).toBe('Invariant1');
      expect(tank.fish('RuleSet1').name).toBe('RuleSet1');
      expect(tank.fish('Mapping1').name).toBe('Mapping1');
    });

    it('should find valid fish when fishing by url for all types', () => {
      expect(tank.fish('http://hl7.org/fhir/us/minimal/StructureDefinition/prf1').name).toBe(
        'Profile1'
      );
      expect(tank.fish('http://hl7.org/fhir/us/minimal/StructureDefinition/ext1').name).toBe(
        'Extension1'
      );
      expect(tank.fish('http://hl7.org/fhir/us/minimal/ValueSet/vs1').name).toBe('ValueSet1');
      expect(tank.fish('http://hl7.org/fhir/us/minimal/CodeSystem/cs1').name).toBe('CodeSystem1');
      // not applicable for Instance or Invariant or RuleSet or Mapping
    });

    it('should not find fish when fishing by invalid name/id/url', () => {
      expect(tank.fish('Profile3')).toBeUndefined();
    });

    it('should only find profiles when profiles are requested', () => {
      expect(tank.fish('prf1', Type.Profile).name).toBe('Profile1');
      expect(
        tank.fish(
          'prf1',
          Type.Extension,
          Type.ValueSet,
          Type.CodeSystem,
          Type.Instance,
          Type.Invariant,
          Type.RuleSet,
          Type.Mapping,
          Type.Resource,
          Type.Type
        )
      ).toBeUndefined();
    });

    it('should only find extensions when extensions are requested', () => {
      expect(tank.fish('ext1', Type.Extension).name).toBe('Extension1');
      expect(
        tank.fish(
          'ext1',
          Type.Profile,
          Type.ValueSet,
          Type.CodeSystem,
          Type.Instance,
          Type.Invariant,
          Type.RuleSet,
          Type.Mapping,
          Type.Resource,
          Type.Type
        )
      ).toBeUndefined();
    });

    it('should only find valuesets when valuesets are requested', () => {
      expect(tank.fish('vs1', Type.ValueSet).name).toBe('ValueSet1');
      expect(
        tank.fish(
          'vs1',
          Type.Profile,
          Type.Extension,
          Type.CodeSystem,
          Type.Instance,
          Type.Invariant,
          Type.RuleSet,
          Type.Mapping,
          Type.Resource,
          Type.Type
        )
      ).toBeUndefined();
    });

    it('should only find codesystems when codesystems are requested', () => {
      expect(tank.fish('cs1', Type.CodeSystem).name).toBe('CodeSystem1');
      expect(
        tank.fish(
          'cs1',
          Type.Profile,
          Type.Extension,
          Type.ValueSet,
          Type.Instance,
          Type.Invariant,
          Type.RuleSet,
          Type.Mapping,
          Type.Resource,
          Type.Type
        )
      ).toBeUndefined();
    });

    it('should only find instances when instances are requested', () => {
      expect(tank.fish('inst1', Type.Instance).name).toBe('Instance1');
      expect(
        tank.fish(
          'inst1',
          Type.Profile,
          Type.Extension,
          Type.ValueSet,
          Type.CodeSystem,
          Type.Invariant,
          Type.RuleSet,
          Type.Mapping,
          Type.Resource,
          Type.Type
        )
      ).toBeUndefined();
    });

    it('should only find invariants when invariants are requested', () => {
      expect(tank.fish('Invariant1', Type.Invariant).name).toBe('Invariant1');
      expect(
        tank.fish(
          'Invariant1',
          Type.Profile,
          Type.Extension,
          Type.ValueSet,
          Type.CodeSystem,
          Type.Instance,
          Type.RuleSet,
          Type.Mapping,
          Type.Resource,
          Type.Type
        )
      ).toBeUndefined();
    });

    it('should only find ruleSets when ruleSets are requested', () => {
      expect(tank.fish('RuleSet1', Type.RuleSet).name).toBe('RuleSet1');
      expect(
        tank.fish(
          'RuleSet1',
          Type.Profile,
          Type.Extension,
          Type.ValueSet,
          Type.CodeSystem,
          Type.Instance,
          Type.Invariant,
          Type.Mapping,
          Type.Resource,
          Type.Type
        )
      ).toBeUndefined();
    });

    it('should only find Mappings when Mappings are requested', () => {
      expect(tank.fish('Mapping1', Type.Mapping).name).toBe('Mapping1');
      expect(
        tank.fish(
          'Mapping1',
          Type.Profile,
          Type.Extension,
          Type.ValueSet,
          Type.CodeSystem,
          Type.Instance,
          Type.Invariant,
          Type.RuleSet,
          Type.Resource,
          Type.Type
        )
      ).toBeUndefined();
    });
  });

  describe('#fishForMetadata', () => {
    const prf1MD: Metadata = {
      id: 'prf1',
      name: 'Profile1',
      url: 'http://hl7.org/fhir/us/minimal/StructureDefinition/prf1',
      parent: 'Observation',
      version: '1.0.0'
    };
    const ext1MD: Metadata = {
      id: 'ext1',
      name: 'Extension1',
      url: 'http://hl7.org/fhir/us/minimal/StructureDefinition/ext1',
      parent: 'Extension2',
      version: '1.0.0'
    };
    const vs1MD: Metadata = {
      id: 'vs1',
      name: 'ValueSet1',
      url: 'http://hl7.org/fhir/us/minimal/ValueSet/vs1',
      version: '1.0.0'
    };
    const cs1MD: Metadata = {
      id: 'cs1',
      name: 'CodeSystem1',
      url: 'http://hl7.org/fhir/us/minimal/CodeSystem/cs1',
      version: '1.0.0'
    };
    const inst1MD: Metadata = {
      id: 'inst1',
      name: 'Instance1'
    };
    const inv1MD: Metadata = {
      id: 'Invariant1', // id will always be name on Invariants
      name: 'Invariant1'
    };
    const rul1MD: Metadata = {
      id: 'RuleSet1', // id will always be name for Mixins
      name: 'RuleSet1'
    };
    const map1MD: Metadata = {
      id: 'map1',
      name: 'Mapping1'
    };

    it('should find valid fish metadata when fishing by id for all types', () => {
      expect(tank.fishForMetadata('prf1')).toEqual(prf1MD);
      expect(tank.fishForMetadata('ext1')).toEqual(ext1MD);
      expect(tank.fishForMetadata('vs1')).toEqual(vs1MD);
      expect(tank.fishForMetadata('cs1')).toEqual(cs1MD);
      expect(tank.fishForMetadata('inst1')).toEqual(inst1MD);
      // not applicable for Invariant or RuleSet or Mapping
    });

    it('should find valid fish when fishing by name for all types', () => {
      expect(tank.fishForMetadata('Profile1')).toEqual(prf1MD);
      expect(tank.fishForMetadata('Extension1')).toEqual(ext1MD);
      expect(tank.fishForMetadata('ValueSet1')).toEqual(vs1MD);
      expect(tank.fishForMetadata('CodeSystem1')).toEqual(cs1MD);
      expect(tank.fishForMetadata('Instance1')).toEqual(inst1MD);
      expect(tank.fishForMetadata('Invariant1')).toEqual(inv1MD);
      expect(tank.fishForMetadata('RuleSet1')).toEqual(rul1MD);
      expect(tank.fishForMetadata('Mapping1')).toEqual(map1MD);
    });

    it('should find valid fish when fishing by url for all types', () => {
      expect(
        tank.fishForMetadata('http://hl7.org/fhir/us/minimal/StructureDefinition/prf1')
      ).toEqual(prf1MD);
      expect(
        tank.fishForMetadata('http://hl7.org/fhir/us/minimal/StructureDefinition/ext1')
      ).toEqual(ext1MD);
      expect(tank.fishForMetadata('http://hl7.org/fhir/us/minimal/ValueSet/vs1')).toEqual(vs1MD);
      expect(tank.fishForMetadata('http://hl7.org/fhir/us/minimal/CodeSystem/cs1')).toEqual(cs1MD);
      // not applicable for Instance or Invariant or RuleSet or Mapping
    });

    it('should not find fish when fishing by invalid name/id/url', () => {
      expect(tank.fishForMetadata('Profile3')).toBeUndefined();
    });

    it('should only find profiles when profiles are requested', () => {
      expect(tank.fishForMetadata('prf1', Type.Profile)).toEqual(prf1MD);
      expect(
        tank.fishForMetadata(
          'prf1',
          Type.Extension,
          Type.ValueSet,
          Type.CodeSystem,
          Type.Instance,
          Type.Invariant,
          Type.RuleSet,
          Type.Mapping,
          Type.Resource,
          Type.Type
        )
      ).toBeUndefined();
    });

    it('should only find extensions when extensions are requested', () => {
      expect(tank.fishForMetadata('ext1', Type.Extension)).toEqual(ext1MD);
      expect(
        tank.fishForMetadata(
          'ext1',
          Type.Profile,
          Type.ValueSet,
          Type.CodeSystem,
          Type.Instance,
          Type.Invariant,
          Type.RuleSet,
          Type.Mapping,
          Type.Resource,
          Type.Type
        )
      ).toBeUndefined();
    });

    it('should only find valuesets when valuesets are requested', () => {
      expect(tank.fishForMetadata('vs1', Type.ValueSet)).toEqual(vs1MD);
      expect(
        tank.fishForMetadata(
          'vs1',
          Type.Profile,
          Type.Extension,
          Type.CodeSystem,
          Type.Instance,
          Type.Invariant,
          Type.RuleSet,
          Type.Mapping,
          Type.Resource,
          Type.Type
        )
      ).toBeUndefined();
    });

    it('should only find codesystems when codesystems are requested', () => {
      expect(tank.fishForMetadata('cs1', Type.CodeSystem)).toEqual(cs1MD);
      expect(
        tank.fishForMetadata(
          'cs1',
          Type.Profile,
          Type.Extension,
          Type.ValueSet,
          Type.Instance,
          Type.Invariant,
          Type.RuleSet,
          Type.Mapping,
          Type.Resource,
          Type.Type
        )
      ).toBeUndefined();
    });

    it('should only find instances when instances are requested', () => {
      expect(tank.fishForMetadata('inst1', Type.Instance)).toEqual(inst1MD);
      expect(
        tank.fishForMetadata(
          'inst1',
          Type.Profile,
          Type.Extension,
          Type.ValueSet,
          Type.CodeSystem,
          Type.Invariant,
          Type.RuleSet,
          Type.Mapping,
          Type.Resource,
          Type.Type
        )
      ).toBeUndefined();
    });

    it('should only find invariants when invariants are requested', () => {
      expect(tank.fishForMetadata('Invariant1', Type.Invariant)).toEqual(inv1MD);
      expect(
        tank.fishForMetadata(
          'Invariant1',
          Type.Profile,
          Type.Extension,
          Type.ValueSet,
          Type.CodeSystem,
          Type.Instance,
          Type.RuleSet,
          Type.Mapping,
          Type.Resource,
          Type.Type
        )
      ).toBeUndefined();
    });

    it('should only find ruleSets when ruleSets are requested', () => {
      expect(tank.fishForMetadata('RuleSet1', Type.RuleSet)).toEqual(rul1MD);
      expect(
        tank.fishForMetadata(
          'RuleSet1',
          Type.Profile,
          Type.Extension,
          Type.ValueSet,
          Type.CodeSystem,
          Type.Instance,
          Type.Invariant,
          Type.Mapping,
          Type.Resource,
          Type.Type
        )
      ).toBeUndefined();
    });

    it('should only find Mappings when Mappings are requested', () => {
      expect(tank.fishForMetadata('Mapping1', Type.Mapping)).toEqual(map1MD);
      expect(
        tank.fishForMetadata(
          'Mapping1',
          Type.Profile,
          Type.Extension,
          Type.ValueSet,
          Type.CodeSystem,
          Type.Instance,
          Type.Invariant,
          Type.RuleSet,
          Type.Resource,
          Type.Type
        )
      ).toBeUndefined();
    });

    it('should find a version on a Profile when one is specified', () => {
      const profile1 = tank.fish('Profile1', Type.Profile) as Profile;
      const caretRule = new CaretValueRule('');
      caretRule.caretPath = 'version';
      caretRule.value = '1.2.3';
      profile1.rules.push(caretRule);
      expect(tank.fishForMetadata('Profile1', Type.Profile).version).toBe('1.2.3');
    });

    it('should find a version on an Extension when one is specified', () => {
      const ext1 = tank.fish('Extension1', Type.Extension) as Extension;
      const caretRule = new CaretValueRule('');
      caretRule.caretPath = 'version';
      caretRule.value = '1.2.3';
      ext1.rules.push(caretRule);
      expect(tank.fishForMetadata('Extension1', Type.Extension).version).toBe('1.2.3');
    });

    it('should find a version on a FshValueSet when one is specified', () => {
      const vs1 = tank.fish('ValueSet1', Type.ValueSet) as FshValueSet;
      const caretRule = new CaretValueRule('');
      caretRule.caretPath = 'version';
      caretRule.value = '1.2.3';
      vs1.rules.push(caretRule);
      expect(tank.fishForMetadata('ValueSet1', Type.ValueSet).version).toBe('1.2.3');
    });

    it('should use config version on a FshValueSet when one is not specified', () => {
      expect(tank.fishForMetadata('ValueSet1', Type.ValueSet).version).toBe('1.0.0');
    });

    it('should find a version on a FshCodeSystem when one is specified', () => {
      const cs1 = tank.fish('CodeSystem1', Type.CodeSystem) as FshCodeSystem;
      const caretRule = new CaretValueRule('');
      caretRule.caretPath = 'version';
      caretRule.value = '1.2.3';
      cs1.rules.push(caretRule);
      expect(tank.fishForMetadata('CodeSystem1', Type.CodeSystem).version).toBe('1.2.3');
    });
  });

  describe('#fishForFHIR', () => {
    it('should never return any results for fishForFHIR', () => {
      expect(tank.fishForFHIR('prf1')).toBeUndefined();
      expect(tank.fishForFHIR('prf1', Type.Profile)).toBeUndefined();
      expect(tank.fishForFHIR('Profile2')).toBeUndefined();
      expect(
        tank.fishForFHIR('http://hl7.org/fhir/us/minimal/StructureDefinition/prf1')
      ).toBeUndefined();
      expect(tank.fishForFHIR('ext1')).toBeUndefined();
      expect(tank.fishForFHIR('ext1', Type.Extension)).toBeUndefined();
      expect(tank.fishForFHIR('Extension2')).toBeUndefined();
      expect(
        tank.fishForFHIR('http://hl7.org/fhir/us/minimal/StructureDefinition/ext1')
      ).toBeUndefined();
      expect(tank.fishForFHIR('vs1')).toBeUndefined();
      expect(tank.fishForFHIR('vs1', Type.ValueSet)).toBeUndefined();
      expect(tank.fishForFHIR('ValueSet2')).toBeUndefined();
      expect(tank.fishForFHIR('http://hl7.org/fhir/us/minimal/ValueSet/vs1')).toBeUndefined();
      expect(tank.fishForFHIR('cs1')).toBeUndefined();
      expect(tank.fishForFHIR('cs1', Type.CodeSystem)).toBeUndefined();
      expect(tank.fishForFHIR('CodeSystem2')).toBeUndefined();
      expect(tank.fishForFHIR('http://hl7.org/fhir/us/minimal/ValueSet/vs1')).toBeUndefined();
      expect(tank.fishForFHIR('inst1')).toBeUndefined();
      expect(tank.fishForFHIR('inst1', Type.Instance)).toBeUndefined();
      expect(tank.fishForFHIR('Instance1')).toBeUndefined();
      expect(tank.fishForFHIR('Invariant1')).toBeUndefined();
      expect(tank.fishForFHIR('Invariant1', Type.Invariant)).toBeUndefined();
      expect(tank.fishForFHIR('RuleSet1')).toBeUndefined();
      expect(tank.fishForFHIR('RuleSet1', Type.RuleSet)).toBeUndefined();
      expect(tank.fishForFHIR('map1')).toBeUndefined();
      expect(tank.fishForFHIR('map1', Type.Mapping)).toBeUndefined();
      expect(tank.fishForFHIR('Mapping1')).toBeUndefined();
    });
  });
});
