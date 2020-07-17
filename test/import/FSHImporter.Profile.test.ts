import {
  assertCardRule,
  assertFixedValueRule,
  assertFlagRule,
  assertOnlyRule,
  assertValueSetRule,
  assertContainsRule,
  assertCaretValueRule,
  assertObeysRule,
  assertInsertRule
} from '../testhelpers/asserts';
import { FshCanonical, FshCode, FshQuantity, FshRatio, FshReference } from '../../src/fshtypes';
import { loggerSpy } from '../testhelpers/loggerSpy';
import { importSingleText } from '../testhelpers/importSingleText';

describe('FSHImporter', () => {
  describe('Profile', () => {
    describe('#sdMetadata', () => {
      it('should parse the simplest possible profile', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        `;

        const result = importSingleText(input, 'Simple.fsh');
        expect(result.profiles.size).toBe(1);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.name).toBe('ObservationProfile');
        expect(profile.parent).toBe('Observation');
        // if no id is explicitly set, should default to name
        expect(profile.id).toBe('ObservationProfile');
        expect(profile.sourceInfo.location).toEqual({
          startLine: 2,
          startColumn: 9,
          endLine: 3,
          endColumn: 27
        });
        expect(profile.sourceInfo.file).toBe('Simple.fsh');
      });

      it('should parse profile with additional metadata properties', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        Id: observation-profile
        Title: "An Observation Profile"
        Description: "A profile on Observation"
        Mixins: Mixin1 and Mixin2 and Mixin3 and Mixin4
        `;

        const result = importSingleText(input);
        expect(result.profiles.size).toBe(1);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.name).toBe('ObservationProfile');
        expect(profile.parent).toBe('Observation');
        expect(profile.id).toBe('observation-profile');
        expect(profile.title).toBe('An Observation Profile');
        expect(profile.description).toBe('A profile on Observation');
        expect(profile.mixins).toEqual(['Mixin1', 'Mixin2', 'Mixin3', 'Mixin4']);
        expect(profile.sourceInfo.location).toEqual({
          startLine: 2,
          startColumn: 9,
          endLine: 7,
          endColumn: 55
        });
      });

      it('should properly parse a multi-string description', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        Description:
          """
          This is a multi-string description
          with a couple of paragraphs.

          This is the second paragraph.  It has bullet points w/ indentation:

          * Bullet 1
            * Bullet A
            * Bullet B
              * Bullet i
            * Bullet C
          * Bullet 2
          """
        `;

        const result = importSingleText(input);
        expect(result.profiles.size).toBe(1);
        const profile = result.profiles.get('ObservationProfile');
        const expectedDescriptionLines = [
          'This is a multi-string description',
          'with a couple of paragraphs.',
          '',
          'This is the second paragraph.  It has bullet points w/ indentation:',
          '',
          '* Bullet 1',
          '  * Bullet A',
          '  * Bullet B',
          '    * Bullet i',
          '  * Bullet C',
          '* Bullet 2'
        ];
        expect(profile.description).toBe(expectedDescriptionLines.join('\n'));
      });

      it('should accept and translate an alias for the parent', () => {
        const input = `
        Alias: OBS = http://hl7.org/fhir/StructureDefinition/Observation

        Profile: ObservationProfile
        Parent: OBS
        `;

        const result = importSingleText(input);
        expect(result.profiles.size).toBe(1);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.name).toBe('ObservationProfile');
        expect(profile.parent).toBe('http://hl7.org/fhir/StructureDefinition/Observation');
      });

      it('should only apply each metadata attribute the first time it is declared', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        Id: observation-profile
        Title: "An Observation Profile"
        Description: "A profile on Observation"
        Mixins: Mixin1
        Parent: DuplicateObservation
        Id: duplicate-observation-profile
        Title: "Duplicate Observation Profile"
        Description: "A duplicated profile on Observation"
        Mixins: DuplicateMixin1
        `;

        const result = importSingleText(input);
        expect(result.profiles.size).toBe(1);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.name).toBe('ObservationProfile');
        expect(profile.id).toBe('observation-profile');
        expect(profile.title).toBe('An Observation Profile');
        expect(profile.description).toBe('A profile on Observation');
        expect(profile.mixins).toEqual(['Mixin1']);
      });

      it('should deduplicate repeated mixins and log a warning', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        Mixins: Mixin1 and Mixin2 and Mixin1
        `;

        const result = importSingleText(input, 'Dupe.fsh');
        expect(result.profiles.size).toBe(1);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.name).toBe('ObservationProfile');
        expect(profile.mixins).toEqual(['Mixin1', 'Mixin2']);
        expect(loggerSpy.getLastMessage('warn')).toMatch(/Mixin1.*File: Dupe.fsh.*Line: 4\D*/s);
      });

      it('should log an error when encountering a duplicate metadata attribute', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        Id: observation-profile
        Title: "An Observation Profile"
        Description: "A profile on Observation"
        Title: "Duplicate Observation Profile"
        Description: "A duplicated profile on Observation"
        `;

        importSingleText(input, 'Dupe.fsh');
        expect(loggerSpy.getMessageAtIndex(-2, 'error')).toMatch(/File: Dupe\.fsh.*Line: 7\D*/s);
        expect(loggerSpy.getLastMessage('error')).toMatch(/File: Dupe\.fsh.*Line: 8\D*/s);
      });

      it('should log an error and skip the profile when encountering a profile with a name used by another profile', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        Title: "First Observation Profile"

        Profile: ObservationProfile
        Parent: Observation
        Title: "Second Observation Profile"
        `;
        const result = importSingleText(input, 'SameName.fsh');
        expect(result.profiles.size).toBe(1);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.title).toBe('First Observation Profile');
        expect(loggerSpy.getLastMessage('error')).toMatch(
          /Profile named ObservationProfile already exists/s
        );
        expect(loggerSpy.getLastMessage('error')).toMatch(/File: SameName\.fsh.*Line: 6 - 8\D*/s);
      });
    });

    describe('#cardRule', () => {
      it('should parse simple card rules', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * category 1..5
        * value[x] 1..1
        * component 2..*
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(3);
        assertCardRule(profile.rules[0], 'category', 1, 5);
        assertCardRule(profile.rules[1], 'value[x]', 1, 1);
        assertCardRule(profile.rules[2], 'component', 2, '*');
      });

      it('should parse card rule with only min', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * category 1..
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        assertCardRule(profile.rules[0], 'category', 1, ''); // Unspecified max
      });

      it('should parse card rule with only max', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * category ..5
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        assertCardRule(profile.rules[0], 'category', NaN, '5'); // Unspecified min
      });

      it('should log an error if neither side is specified', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * category ..
        `;

        const result = importSingleText(input, 'BadCard.fsh');
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1); // Rule is still set and element's current cardinalities will be used at export
        expect(loggerSpy.getLastMessage('error')).toMatch(
          /Neither side of the cardinality was specified on path \"category\". A min, max, or both need to be specified.\D*/s
        );
        expect(loggerSpy.getLastMessage('error')).toMatch(/File: BadCard\.fsh.*Line: 4\D*/s);
      });

      it('should parse card rules w/ flags', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * category 1..5 MS
        * value[x] 1..1 ?!
        * component 2..* SU
        * interpretation 1..* TU
        * note 0..11 N
        * bodySite 1..1 D
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(12);
        assertCardRule(profile.rules[0], 'category', 1, 5);
        assertFlagRule(
          profile.rules[1],
          'category',
          true,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined
        );
        assertCardRule(profile.rules[2], 'value[x]', 1, 1);
        assertFlagRule(
          profile.rules[3],
          'value[x]',
          undefined,
          undefined,
          true,
          undefined,
          undefined,
          undefined
        );
        assertCardRule(profile.rules[4], 'component', 2, '*');
        assertFlagRule(
          profile.rules[5],
          'component',
          undefined,
          true,
          undefined,
          undefined,
          undefined,
          undefined
        );
        assertCardRule(profile.rules[6], 'interpretation', 1, '*');
        assertFlagRule(
          profile.rules[7],
          'interpretation',
          undefined,
          undefined,
          undefined,
          true,
          undefined,
          undefined
        );
        assertCardRule(profile.rules[8], 'note', 0, '11');
        assertFlagRule(
          profile.rules[9],
          'note',
          undefined,
          undefined,
          undefined,
          undefined,
          true,
          undefined
        );
        assertCardRule(profile.rules[10], 'bodySite', 1, '1');
        assertFlagRule(
          profile.rules[11],
          'bodySite',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          true
        );
      });

      it('should parse card rules w/ multiple flags', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * category 1..5 MS ?! TU
        * value[x] 1..1 ?! SU N
        * component 2..* SU MS D
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(6);
        assertCardRule(profile.rules[0], 'category', 1, 5);
        assertFlagRule(
          profile.rules[1],
          'category',
          true,
          undefined,
          true,
          true,
          undefined,
          undefined
        );
        assertCardRule(profile.rules[2], 'value[x]', 1, 1);
        assertFlagRule(
          profile.rules[3],
          'value[x]',
          undefined,
          true,
          true,
          undefined,
          true,
          undefined
        );
        assertCardRule(profile.rules[4], 'component', 2, '*');
        assertFlagRule(
          profile.rules[5],
          'component',
          true,
          true,
          undefined,
          undefined,
          undefined,
          true
        );
      });
    });

    describe('#flagRule', () => {
      it('should parse single-path single-value flag rules', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * category MS
        * value[x] ?!
        * component SU
        * interpretation TU
        * note N
        * bodySite D
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(6);
        assertFlagRule(
          profile.rules[0],
          'category',
          true,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined
        );
        assertFlagRule(
          profile.rules[1],
          'value[x]',
          undefined,
          undefined,
          true,
          undefined,
          undefined,
          undefined
        );
        assertFlagRule(
          profile.rules[2],
          'component',
          undefined,
          true,
          undefined,
          undefined,
          undefined,
          undefined
        );
        assertFlagRule(
          profile.rules[3],
          'interpretation',
          undefined,
          undefined,
          undefined,
          true,
          undefined,
          undefined
        );
        assertFlagRule(
          profile.rules[4],
          'note',
          undefined,
          undefined,
          undefined,
          undefined,
          true,
          undefined
        );
        assertFlagRule(
          profile.rules[5],
          'bodySite',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          true
        );
      });

      it('should parse single-path multi-value flag rules', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * category MS ?! N
        * value[x] ?! SU D
        * component MS SU ?! TU
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(3);
        assertFlagRule(
          profile.rules[0],
          'category',
          true,
          undefined,
          true,
          undefined,
          true,
          undefined
        );
        assertFlagRule(
          profile.rules[1],
          'value[x]',
          undefined,
          true,
          true,
          undefined,
          undefined,
          true
        );
        assertFlagRule(profile.rules[2], 'component', true, true, true, true, undefined, undefined);
      });

      it('should parse multi-path single-value flag rules', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * category and value[x] and component MS
        * subject and focus ?!
        * interpretation and note N
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(7);
        assertFlagRule(
          profile.rules[0],
          'category',
          true,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined
        );
        assertFlagRule(
          profile.rules[1],
          'value[x]',
          true,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined
        );
        assertFlagRule(
          profile.rules[2],
          'component',
          true,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined
        );
        assertFlagRule(
          profile.rules[3],
          'subject',
          undefined,
          undefined,
          true,
          undefined,
          undefined,
          undefined
        );
        assertFlagRule(
          profile.rules[4],
          'focus',
          undefined,
          undefined,
          true,
          undefined,
          undefined,
          undefined
        );
        assertFlagRule(
          profile.rules[5],
          'interpretation',
          undefined,
          undefined,
          undefined,
          undefined,
          true,
          undefined
        );
        assertFlagRule(
          profile.rules[6],
          'note',
          undefined,
          undefined,
          undefined,
          undefined,
          true,
          undefined
        );
      });

      it('should parse multi-path multi-value flag rules', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * category and value[x] and component MS SU N
        * subject and focus ?! SU TU
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(5);
        assertFlagRule(
          profile.rules[0],
          'category',
          true,
          true,
          undefined,
          undefined,
          true,
          undefined
        );
        assertFlagRule(
          profile.rules[1],
          'value[x]',
          true,
          true,
          undefined,
          undefined,
          true,
          undefined
        );
        assertFlagRule(
          profile.rules[2],
          'component',
          true,
          true,
          undefined,
          undefined,
          true,
          undefined
        );
        assertFlagRule(
          profile.rules[3],
          'subject',
          undefined,
          true,
          true,
          true,
          undefined,
          undefined
        );
        assertFlagRule(
          profile.rules[4],
          'focus',
          undefined,
          true,
          true,
          true,
          undefined,
          undefined
        );
      });

      it('should log a warning when paths are listed with commas', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * category, value[x] , component MS SU N
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(3);
        assertFlagRule(
          profile.rules[0],
          'category',
          true,
          true,
          undefined,
          undefined,
          true,
          undefined
        );
        assertFlagRule(
          profile.rules[1],
          'value[x]',
          true,
          true,
          undefined,
          undefined,
          true,
          undefined
        );
        assertFlagRule(
          profile.rules[2],
          'component',
          true,
          true,
          undefined,
          undefined,
          true,
          undefined
        );
        expect(loggerSpy.getLastMessage('warn')).toMatch(/Using "," to list paths is deprecated/s);
      });
    });

    describe('#valueSetRule', () => {
      it('should parse value set rules w/ names and strengths', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * category from CategoryValueSet (required)
        * code from CodeValueSet (extensible)
        * valueCodeableConcept from ValueValueSet (preferred)
        * component.code from ComponentCodeValueSet (example)
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(4);
        assertValueSetRule(profile.rules[0], 'category', 'CategoryValueSet', 'required');
        assertValueSetRule(profile.rules[1], 'code', 'CodeValueSet', 'extensible');
        assertValueSetRule(profile.rules[2], 'valueCodeableConcept', 'ValueValueSet', 'preferred');
        assertValueSetRule(profile.rules[3], 'component.code', 'ComponentCodeValueSet', 'example');
      });

      it('should parse value set rules w/ urls and strengths', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * category from http://example.org/fhir/ValueSet/CategoryValueSet (required)
        * code from http://example.org/fhir/ValueSet/CodeValueSet (extensible)
        * valueCodeableConcept from http://example.org/fhir/ValueSet/ValueValueSet (preferred)
        * component.code from http://example.org/fhir/ValueSet/ComponentCodeValueSet (example)
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(4);
        assertValueSetRule(
          profile.rules[0],
          'category',
          'http://example.org/fhir/ValueSet/CategoryValueSet',
          'required'
        );
        assertValueSetRule(
          profile.rules[1],
          'code',
          'http://example.org/fhir/ValueSet/CodeValueSet',
          'extensible'
        );
        assertValueSetRule(
          profile.rules[2],
          'valueCodeableConcept',
          'http://example.org/fhir/ValueSet/ValueValueSet',
          'preferred'
        );
        assertValueSetRule(
          profile.rules[3],
          'component.code',
          'http://example.org/fhir/ValueSet/ComponentCodeValueSet',
          'example'
        );
      });

      it('should accept and translate aliases for value set URLs', () => {
        const input = `
        Alias: CAT = http://example.org/fhir/ValueSet/CategoryValueSet
        Alias: CODE = http://example.org/fhir/ValueSet/CodeValueSet
        Alias: VALUE = http://example.org/fhir/ValueSet/ValueValueSet
        Alias: COMP = http://example.org/fhir/ValueSet/ComponentCodeValueSet

        Profile: ObservationProfile
        Parent: Observation
        * category from CAT (required)
        * code from CODE (extensible)
        * valueCodeableConcept from VALUE (preferred)
        * component.code from COMP (example)
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(4);
        assertValueSetRule(
          profile.rules[0],
          'category',
          'http://example.org/fhir/ValueSet/CategoryValueSet',
          'required'
        );
        assertValueSetRule(
          profile.rules[1],
          'code',
          'http://example.org/fhir/ValueSet/CodeValueSet',
          'extensible'
        );
        assertValueSetRule(
          profile.rules[2],
          'valueCodeableConcept',
          'http://example.org/fhir/ValueSet/ValueValueSet',
          'preferred'
        );
        assertValueSetRule(
          profile.rules[3],
          'component.code',
          'http://example.org/fhir/ValueSet/ComponentCodeValueSet',
          'example'
        );
      });

      it('should parse value set rules w/ no strength and default to required', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * category from CategoryValueSet
        * code from http://example.org/fhir/ValueSet/CodeValueSet
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(2);
        assertValueSetRule(profile.rules[0], 'category', 'CategoryValueSet', 'required');
        assertValueSetRule(
          profile.rules[1],
          'code',
          'http://example.org/fhir/ValueSet/CodeValueSet',
          'required'
        );
      });

      it('should ignore the units keyword and log a warning when parsing value set rules on Quantity', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * valueQuantity units from http://unitsofmeasure.org
        `;

        const result = importSingleText(input, 'UselessQuant.fsh');
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        assertValueSetRule(
          profile.rules[0],
          'valueQuantity',
          'http://unitsofmeasure.org',
          'required'
        );
        expect(loggerSpy.getLastMessage('warn')).toMatch(
          /The "units" keyword is deprecated and has no effect.*File: UselessQuant\.fsh.*Line: 4\D*/s
        );
      });
    });

    describe('#fixedValueRule', () => {
      it('should parse fixed value boolean rule', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * valueBoolean = true
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        assertFixedValueRule(profile.rules[0], 'valueBoolean', true);
      });

      it('should parse fixed value boolean rule with (exactly) modifier', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * valueBoolean = true (exactly)
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        assertFixedValueRule(profile.rules[0], 'valueBoolean', true, true);
      });

      it('should parse fixed value number rule', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * valueDecimal = 1.23
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        assertFixedValueRule(profile.rules[0], 'valueDecimal', 1.23);
      });

      it('should parse fixed value string rule', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * valueString = "hello world"
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        assertFixedValueRule(profile.rules[0], 'valueString', 'hello world');
      });

      it('should parse fixed value multi-line string rule', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * valueString = """
            hello
            world
            """
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        assertFixedValueRule(profile.rules[0], 'valueString', 'hello\nworld');
      });

      it('should parse fixed value date rule', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * valueDateTime = 2019-11-01T12:30:01.999Z
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        // For now, treating dates like strings
        assertFixedValueRule(profile.rules[0], 'valueDateTime', '2019-11-01T12:30:01.999Z');
      });

      it('should parse fixed value time rule', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * valueTime = 12:30:01.999-05:00
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        // For now, treating dates like strings
        assertFixedValueRule(profile.rules[0], 'valueTime', '12:30:01.999-05:00');
      });

      it('should parse fixed value code rule', () => {
        const input = `
        Alias: LOINC = http://loinc.org

        Profile: ObservationProfile
        Parent: Observation
        * status = #final
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        const expectedCode = new FshCode('final').withLocation([6, 20, 6, 25]).withFile('');
        assertFixedValueRule(profile.rules[0], 'status', expectedCode);
      });

      it('should parse fixed value CodeableConcept rule', () => {
        const input = `
        Alias: LOINC = http://loinc.org

        Profile: ObservationProfile
        Parent: Observation
        * valueCodeableConcept = LOINC#718-7 "Hemoglobin [Mass/volume] in Blood"
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        const expectedCode = new FshCode(
          '718-7',
          'http://loinc.org',
          'Hemoglobin [Mass/volume] in Blood'
        )
          .withLocation([6, 34, 6, 80])
          .withFile('');
        assertFixedValueRule(profile.rules[0], 'valueCodeableConcept', expectedCode);
      });

      it('should parse fixed value CodeableConcept rule with (exactly) modifier', () => {
        const input = `
        Alias: LOINC = http://loinc.org

        Profile: ObservationProfile
        Parent: Observation
        * valueCodeableConcept = LOINC#718-7 "Hemoglobin [Mass/volume] in Blood" (exactly)
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        const expectedCode = new FshCode(
          '718-7',
          'http://loinc.org',
          'Hemoglobin [Mass/volume] in Blood'
        )
          .withLocation([6, 34, 6, 80])
          .withFile('');
        assertFixedValueRule(profile.rules[0], 'valueCodeableConcept', expectedCode, true);
      });

      it('should ignore the units keyword and log a warning when parsing a fixed value FSHCode rule with units on Quantity', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * valueQuantity units = http://unitsofmeasure.org#cGy
        `;

        const result = importSingleText(input, 'UselessUnits.fsh');
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        const expectedCode = new FshCode('cGy', 'http://unitsofmeasure.org')
          .withLocation([4, 33, 4, 61])
          .withFile('UselessUnits.fsh');
        assertFixedValueRule(profile.rules[0], 'valueQuantity', expectedCode);
        expect(loggerSpy.getLastMessage('warn')).toMatch(
          /The "units" keyword is deprecated and has no effect.*File: UselessUnits\.fsh.*Line: 4\D*/s
        );
      });

      it('should parse fixed value Quantity rule', () => {
        const input = `

        Profile: ObservationProfile
        Parent: Observation
        * valueQuantity = 1.5 'mm'
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        const expectedQuantity = new FshQuantity(
          1.5,
          new FshCode('mm', 'http://unitsofmeasure.org').withLocation([5, 31, 5, 34]).withFile('')
        )
          .withLocation([5, 27, 5, 34])
          .withFile('');
        assertFixedValueRule(profile.rules[0], 'valueQuantity', expectedQuantity);
      });

      it('should parse fixed value Ratio rule', () => {
        const input = `

        Profile: ObservationProfile
        Parent: Observation
        * valueRatio = 130 'mg' : 1 'dL'
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        const expectedRatio = new FshRatio(
          new FshQuantity(
            130,
            new FshCode('mg', 'http://unitsofmeasure.org').withLocation([5, 28, 5, 31]).withFile('')
          )
            .withLocation([5, 24, 5, 31])
            .withFile(''),
          new FshQuantity(
            1,
            new FshCode('dL', 'http://unitsofmeasure.org').withLocation([5, 37, 5, 40]).withFile('')
          )
            .withLocation([5, 35, 5, 40])
            .withFile('')
        )
          .withLocation([5, 24, 5, 40])
          .withFile('');
        assertFixedValueRule(profile.rules[0], 'valueRatio', expectedRatio);
      });

      it('should parse fixed value Ratio rule w/ numeric numerator', () => {
        const input = `

        Profile: ObservationProfile
        Parent: Observation
        * valueRatio = 130 : 1 'dL'
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        const expectedRatio = new FshRatio(
          new FshQuantity(130).withLocation([5, 24, 5, 26]).withFile(''),
          new FshQuantity(
            1,
            new FshCode('dL', 'http://unitsofmeasure.org').withLocation([5, 32, 5, 35]).withFile('')
          )
            .withLocation([5, 30, 5, 35])
            .withFile('')
        )
          .withLocation([5, 24, 5, 35])
          .withFile('');
        assertFixedValueRule(profile.rules[0], 'valueRatio', expectedRatio);
      });

      it('should parse fixed value Ratio rule w/ numeric denominator', () => {
        const input = `

        Profile: ObservationProfile
        Parent: Observation
        * valueRatio = 130 'mg' : 1
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        const expectedRatio = new FshRatio(
          new FshQuantity(
            130,
            new FshCode('mg', 'http://unitsofmeasure.org').withLocation([5, 28, 5, 31]).withFile('')
          )
            .withLocation([5, 24, 5, 31])
            .withFile(''),
          new FshQuantity(1).withLocation([5, 35, 5, 35]).withFile('')
        )
          .withLocation([5, 24, 5, 35])
          .withFile('');
        assertFixedValueRule(profile.rules[0], 'valueRatio', expectedRatio);
      });

      it('should parse fixed value Ratio rule w/ numeric numerator and denominator', () => {
        const input = `

        Profile: ObservationProfile
        Parent: Observation
        * valueRatio = 130 : 1
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        const expectedRatio = new FshRatio(
          new FshQuantity(130).withLocation([5, 24, 5, 26]).withFile(''),
          new FshQuantity(1).withLocation([5, 30, 5, 30]).withFile('')
        )
          .withLocation([5, 24, 5, 30])
          .withFile('');
        assertFixedValueRule(profile.rules[0], 'valueRatio', expectedRatio);
      });

      it('should parse fixed value Reference rule', () => {
        const input = `

        Profile: ObservationProfile
        Parent: Observation
        * basedOn = Reference(fooProfile)
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);

        const expectedReference = new FshReference('fooProfile')
          .withLocation([5, 21, 5, 41])
          .withFile('');
        assertFixedValueRule(profile.rules[0], 'basedOn', expectedReference);
      });

      it('should parse fixed value Reference rules while allowing and translating aliases', () => {
        const input = `
        Alias: FOO = http://hl7.org/fhir/StructureDefinition/Foo

        Profile: ObservationProfile
        Parent: Observation
        * basedOn = Reference(FOO) "bar"
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);

        const expectedReference = new FshReference(
          'http://hl7.org/fhir/StructureDefinition/Foo',
          'bar'
        )
          .withLocation([6, 21, 6, 40])
          .withFile('');
        assertFixedValueRule(profile.rules[0], 'basedOn', expectedReference);
      });

      it('should parse fixed value Reference rule with a display string', () => {
        const input = `

        Profile: ObservationProfile
        Parent: Observation
        * basedOn = Reference(fooProfile) "bar"
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);

        const expectedReference = new FshReference('fooProfile', 'bar')
          .withLocation([5, 21, 5, 47])
          .withFile('');
        assertFixedValueRule(profile.rules[0], 'basedOn', expectedReference);
      });

      it('should log an error when a fixed value Reference rule has a choice of references', () => {
        const input = `

        Profile: ObservationProfile
        Parent: Observation
        * basedOn = Reference(cakeProfile or pieProfile)
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);

        const expectedReference = new FshReference('cakeProfile')
          .withLocation([5, 21, 5, 56])
          .withFile('');
        assertFixedValueRule(profile.rules[0], 'basedOn', expectedReference);
        expect(loggerSpy.getLastMessage('error')).toMatch(
          /Multiple choices of references are not allowed when setting a value.*Line: 5\D*/s
        );
      });

      it('should parse fixed value using Canonical', () => {
        const input = `
        CodeSystem: Example
        * #first
        * #second

        Profile: ObservationProfile
        Parent: Observation
        * code.coding.system = Canonical(Example)
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);

        const expectedCanonical = new FshCanonical('Example')
          .withLocation([8, 32, 8, 49])
          .withFile('');
        assertFixedValueRule(profile.rules[0], 'code.coding.system', expectedCanonical);
      });

      it('should parse fixed value using Canonical with spaces around entity name', () => {
        const input = `
        CodeSystem: SpaceyExample
        * #first
        * #second

        Profile: ObservationProfile
        Parent: Observation
        * code.coding.system = Canonical(   SpaceyExample )
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);

        const expectedCanonical = new FshCanonical('SpaceyExample') // No spaces are included in the entityName
          .withLocation([8, 32, 8, 59])
          .withFile('');
        assertFixedValueRule(profile.rules[0], 'code.coding.system', expectedCanonical);
      });

      it('should parse fixed value using Canonical with a version', () => {
        const input = `
        CodeSystem: Example
        * #first
        * #second

        Profile: ObservationProfile
        Parent: Observation
        * code.coding.system = Canonical(Example|1.2.3)
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);

        const expectedCanonical = new FshCanonical('Example')
          .withLocation([8, 32, 8, 55])
          .withFile('');
        expectedCanonical.version = '1.2.3';
        assertFixedValueRule(profile.rules[0], 'code.coding.system', expectedCanonical);
      });

      it('should parse fixed value using Canonical with spaces around the version', () => {
        const input = `
        CodeSystem: Example
        * #first
        * #second

        Profile: ObservationProfile
        Parent: Observation
        * code.coding.system = Canonical(  Example | 1.2.3  )
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);

        const expectedCanonical = new FshCanonical('Example')
          .withLocation([8, 32, 8, 61])
          .withFile('');
        expectedCanonical.version = '1.2.3';
        assertFixedValueRule(profile.rules[0], 'code.coding.system', expectedCanonical);
      });

      it('should parse fixed value using Canonical with a version which contains a |', () => {
        const input = `
        CodeSystem: Example
        * #first
        * #second

        Profile: ObservationProfile
        Parent: Observation
        * code.coding.system = Canonical(  Example | 1.2.3|aWeirdVersion  )
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);

        const expectedCanonical = new FshCanonical('Example')
          .withLocation([8, 32, 8, 75])
          .withFile('');
        expectedCanonical.version = '1.2.3|aWeirdVersion';
        assertFixedValueRule(profile.rules[0], 'code.coding.system', expectedCanonical);
      });

      it('should parse fixed value using Canonical with the default version', () => {
        const input = `
        CodeSystem: Example
        * #first
        * #second

        Profile: ObservationProfile
        Parent: Observation
        * code.coding.system = Canonical(Example|version)
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);

        const expectedCanonical = new FshCanonical('Example')
          .withLocation([8, 32, 8, 57])
          .withFile('');
        expectedCanonical.useEntityVersion = true;
        assertFixedValueRule(profile.rules[0], 'code.coding.system', expectedCanonical);
      });

      it('should parse fixed values that are an alias', () => {
        const input = `
        Alias: EXAMPLE = http://example.org

        Profile: PatientProfile
        Parent: Patient
        * identifier.system = EXAMPLE
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('PatientProfile');
        expect(profile.rules).toHaveLength(1);
        assertFixedValueRule(profile.rules[0], 'identifier.system', 'http://example.org');
      });

      it('should log an error and skip the rule when parsing fixed value Resource rule', () => {
        const input = `

        Profile: ObservationProfile
        Parent: Observation
        * contained[0] = SomeInstance
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(0);
        expect(loggerSpy.getLastMessage('error')).toMatch(
          /Resources cannot be added inline to a Profile or Extension, skipping rule\..*Line: 5\D*/s
        );
      });
    });

    describe('#onlyRule', () => {
      it('should parse an only rule with one type', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * value[x] only Quantity
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        assertOnlyRule(profile.rules[0], 'value[x]', { type: 'Quantity' });
      });

      it('should parse an only rule with multiple types', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * value[x] only Quantity or CodeableConcept or string
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        assertOnlyRule(
          profile.rules[0],
          'value[x]',
          { type: 'Quantity' },
          { type: 'CodeableConcept' },
          { type: 'string' }
        );
      });

      it('should parse an only rule with a reference to one type', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * performer only Reference(Practitioner)
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        assertOnlyRule(profile.rules[0], 'performer', { type: 'Practitioner', isReference: true });
      });

      it('should parse an only rule with a reference to multiple types', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * performer only Reference(Organization or CareTeam)
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        assertOnlyRule(
          profile.rules[0],
          'performer',
          { type: 'Organization', isReference: true },
          { type: 'CareTeam', isReference: true }
        );
      });

      it('should allow and translate aliases for only types', () => {
        const input = `
        Alias: QUANTITY = http://hl7.org/fhir/StructureDefinition/Quantity
        Alias: CODING = http://hl7.org/fhir/StructureDefinition/Coding

        Profile: ObservationProfile
        Parent: Observation
        * value[x] only CodeableConcept or CODING or string or QUANTITY
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        assertOnlyRule(
          profile.rules[0],
          'value[x]',
          { type: 'CodeableConcept' },
          { type: 'http://hl7.org/fhir/StructureDefinition/Coding' },
          { type: 'string' },
          { type: 'http://hl7.org/fhir/StructureDefinition/Quantity' }
        );
      });

      it('should log a warning when references are listed with pipes', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * performer only Reference(Organization | CareTeam)
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        assertOnlyRule(
          profile.rules[0],
          'performer',
          { type: 'Organization', isReference: true },
          { type: 'CareTeam', isReference: true }
        );
        expect(loggerSpy.getLastMessage('warn')).toMatch(
          /Using "\|" to list references is deprecated\..*Line: 4\D*/s
        );
      });
    });

    describe('#containsRule', () => {
      it('should parse contains rule with one item', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * component contains SystolicBP 1..1
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(2);
        assertContainsRule(profile.rules[0], 'component', 'SystolicBP');
        assertCardRule(profile.rules[1], 'component[SystolicBP]', 1, 1);
      });

      it('should parse contains rule with one item declaring an aliased type', () => {
        const input = `
        Alias: OffsetExtension = http://hl7.org/fhir/StructureDefinition/observation-timeOffset
        Profile: ObservationProfile
        Parent: Observation
        * component.extension contains OffsetExtension named offset 0..1
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(2);
        assertContainsRule(profile.rules[0], 'component.extension', {
          name: 'offset',
          type: 'http://hl7.org/fhir/StructureDefinition/observation-timeOffset'
        });
        assertCardRule(profile.rules[1], 'component.extension[offset]', 0, 1);
      });

      it('should parse contains rule with one item declaring an FSH extension type', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * component.extension contains ComponentExtension named compext 0..1

        Extension: ComponentExtension
        Id: component-extension
        * value[x] only CodeableConcept
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(2);
        assertContainsRule(profile.rules[0], 'component.extension', {
          name: 'compext',
          type: 'ComponentExtension'
        });
        assertCardRule(profile.rules[1], 'component.extension[compext]', 0, 1);
      });

      it('should parse contains rules with multiple items', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * component contains SystolicBP 1..1 and DiastolicBP 2..*
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(3);
        assertContainsRule(profile.rules[0], 'component', 'SystolicBP', 'DiastolicBP');
        assertCardRule(profile.rules[1], 'component[SystolicBP]', 1, 1);
        assertCardRule(profile.rules[2], 'component[DiastolicBP]', 2, '*');
      });

      it('should parse contains rule with mutliple items, some declaring types', () => {
        const input = `
        Alias: FocusCodeExtension = http://hl7.org/fhir/StructureDefinition/observation-focusCode
        Alias: PreconditionExtension = http://hl7.org/fhir/StructureDefinition/observation-precondition
        Profile: ObservationProfile
        Parent: Observation
        * extension contains
            foo 0..1 and
            FocusCodeExtension named focus 1..1 and
            bar 0..* and
            PreconditionExtension named pc 1..*
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(5);
        assertContainsRule(
          profile.rules[0],
          'extension',
          'foo',
          {
            name: 'focus',
            type: 'http://hl7.org/fhir/StructureDefinition/observation-focusCode'
          },
          'bar',
          {
            name: 'pc',
            type: 'http://hl7.org/fhir/StructureDefinition/observation-precondition'
          }
        );
        assertCardRule(profile.rules[1], 'extension[foo]', 0, 1);
        assertCardRule(profile.rules[2], 'extension[focus]', 1, 1);
        assertCardRule(profile.rules[3], 'extension[bar]', 0, '*');
        assertCardRule(profile.rules[4], 'extension[pc]', 1, '*');
      });

      it('should parse contains rules with flags', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * component contains SystolicBP 1..1 MS D and DiastolicBP 2..* MS SU
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(5);
        assertContainsRule(profile.rules[0], 'component', 'SystolicBP', 'DiastolicBP');
        assertCardRule(profile.rules[1], 'component[SystolicBP]', 1, 1);
        assertFlagRule(
          profile.rules[2],
          'component[SystolicBP]',
          true,
          undefined,
          undefined,
          undefined,
          undefined,
          true
        );
        assertCardRule(profile.rules[3], 'component[DiastolicBP]', 2, '*');
        assertFlagRule(
          profile.rules[4],
          'component[DiastolicBP]',
          true,
          true,
          undefined,
          undefined,
          undefined,
          undefined
        );
      });

      it('should parse contains rule with item declaring a type and flags', () => {
        const input = `
        Alias: OffsetExtension = http://hl7.org/fhir/StructureDefinition/observation-timeOffset
        Profile: ObservationProfile
        Parent: Observation
        * component.extension contains OffsetExtension named offset 0..1 MS TU
        `;

        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(3);
        assertContainsRule(profile.rules[0], 'component.extension', {
          name: 'offset',
          type: 'http://hl7.org/fhir/StructureDefinition/observation-timeOffset'
        });
        assertCardRule(profile.rules[1], 'component.extension[offset]', 0, 1);
        assertFlagRule(
          profile.rules[2],
          'component.extension[offset]',
          true,
          undefined,
          undefined,
          true,
          undefined,
          undefined
        );
      });
    });

    describe('#caretValueRule', () => {
      it('should parse caret value rules with no path', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * ^description = "foo"
        * ^experimental = false
        * ^keyword[0] = foo#bar "baz"
        `;
        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        assertCaretValueRule(profile.rules[0], '', 'description', 'foo', false);
        assertCaretValueRule(profile.rules[1], '', 'experimental', false, false);
        assertCaretValueRule(
          profile.rules[2],
          '',
          'keyword[0]',
          new FshCode('bar', 'foo', 'baz').withLocation([6, 25, 6, 37]).withFile(''),
          false
        );
      });

      it('should parse caret value rules with a path', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * status ^short = "foo"
        * status ^sliceIsConstraining = false
        * status ^code[0] = foo#bar "baz"
        `;
        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        assertCaretValueRule(profile.rules[0], 'status', 'short', 'foo', false);
        assertCaretValueRule(profile.rules[1], 'status', 'sliceIsConstraining', false, false);
        assertCaretValueRule(
          profile.rules[2],
          'status',
          'code[0]',
          new FshCode('bar', 'foo', 'baz').withLocation([6, 29, 6, 41]).withFile(''),
          false
        );
      });

      it('should not include non-breaking spaces as part of the caret path', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * status ^short\u00A0= "Non-breaking"
        `;
        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        assertCaretValueRule(profile.rules[0], 'status', 'short', 'Non-breaking', false);
      });

      it('should add resources to the contained array using a CaretValueRule', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * ^contained = myResource
        `;
        const result = importSingleText(input);
        const profile = result.profiles.get('ObservationProfile');
        assertCaretValueRule(profile.rules[0], '', 'contained', 'myResource', true);
      });
    });

    describe('#obeysRule', () => {
      it('should parse an obeys rule with one invariant and no path', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * obeys SomeInvariant
        `;
        const result = importSingleText(input, 'Obeys.fsh');
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        assertObeysRule(profile.rules[0], '', 'SomeInvariant');
      });

      it('should parse an obeys rule with one invariant and a path', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * category obeys SomeInvariant
        `;
        const result = importSingleText(input, 'Obeys.fsh');
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        assertObeysRule(profile.rules[0], 'category', 'SomeInvariant');
      });

      it('should parse an obeys rule with multiple invariants and no path', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * obeys SomeInvariant and ThisInvariant and ThatInvariant
        `;
        const result = importSingleText(input, 'Obeys.fsh');
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(3);
        assertObeysRule(profile.rules[0], '', 'SomeInvariant');
        assertObeysRule(profile.rules[1], '', 'ThisInvariant');
        assertObeysRule(profile.rules[2], '', 'ThatInvariant');
      });

      it('should parse an obeys rule with multiple invariants and a path', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * category obeys SomeInvariant and ThisInvariant and ThatInvariant
        `;
        const result = importSingleText(input, 'Obeys.fsh');
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(3);
        assertObeysRule(profile.rules[0], 'category', 'SomeInvariant');
        assertObeysRule(profile.rules[1], 'category', 'ThisInvariant');
        assertObeysRule(profile.rules[2], 'category', 'ThatInvariant');
      });
    });

    describe('#insertRule', () => {
      it('should parse an insert rule with a single RuleSet', () => {
        const input = `
        Profile: ObservationProfile
        Parent: Observation
        * insert MyRuleSet
        `;
        const result = importSingleText(input, 'Insert.fsh');
        const profile = result.profiles.get('ObservationProfile');
        expect(profile.rules).toHaveLength(1);
        assertInsertRule(profile.rules[0], 'MyRuleSet');
      });
    });
  });
});
