import { parse, FileDiff } from '../src/util/diff-parser';

describe('diff parser', () => {
    it('parses a multi-file diff correctly', () => {
        const input =
            'diff --git a/Blubber bla b/Blubber bla\n' +
            'index a99ea25..a54e265 100644\n' +
            '--- a/Blubber bla\n' +
            '+++ b/Blubber bla\n' +
            '@@ -1 +1,2 @@\n' +
            '-fhgdfjnsdgtfhjs\n' +
            '\\ No newline at end of file\n' +
            '+\n' +
            '+Some more lines\n' +
            'diff --git a/testfile-renamedq b/testfile-renamedq\n' +
            'index 83956ed..74ab465 100644\n' +
            '--- a/testfile-renamedq\n' +
            '+++ b/testfile-renamedq\n' +
            '@@ -1,8 +1,20 @@\n' +
            ' Lets see...\n' +
            ' \n' +
            '+fdkjghskfdjhglskjdfhglksjhfglksjhdfgl\n' +
            '+sfkgjhsdflkgjshdflg\n' +
            '+sdfkgjhsdflgkhjs\n' +
            '+lksdfjhgsldf\n' +
            '+\n' +
            ' \n' +
            ' Some totally new content\n' +
            ' \n' +
            ' Oops, forgot something\n' +
            ' \n' +
            '-ksdjhfkjsafhglakjfdhglakjhdgflkajhdlfkjahdlfkjhaldksjfhaldkjshfla\n' +
            '\\ No newline at end of file\n' +
            '+ksdjhfkjsafhglakjfdhglakjhdgflkajhdlfkjahdlfkjhaldksjfhaldkjshfla\n' +
            '+\n' +
            '+\n' +
            '+\n' +
            '+fgkjsdfhgkljsdfhglksjhdfglskjhdflgksjhdfg\n' +
            '+sdfglskdfjhgslkdfjhgslkdfg\n' +
            '+ldfgjdöcv\n' +
            '+dfjkvhsldfkj gadlfkvhgspi uhagqewpufgzh p\n' +
            '\\ No newline at end of file';
        const parsed = parse(input);
        expect(parsed).toStrictEqual([
            {
                header: [
                    'diff --git a/Blubber bla b/Blubber bla',
                    'index a99ea25..a54e265 100644',
                    '--- a/Blubber bla',
                    '+++ b/Blubber bla'
                ],
                newName: 'Blubber bla',
                oldName: 'Blubber bla',
                chunks: [
                    {
                        header: '@@ -1 +1,2 @@',
                        lines: [
                            {
                                type: 'delete',
                                content: '-fhgdfjnsdgtfhjs',
                                oldNumber: 1,
                                newNumber: undefined
                            },
                            {
                                type: 'pseudo-context',
                                content: '\\ No newline at end of file',
                                oldNumber: undefined,
                                newNumber: undefined
                            },
                            { type: 'insert', content: '+', oldNumber: undefined, newNumber: 1 },
                            {
                                type: 'insert',
                                content: '+Some more lines',
                                oldNumber: undefined,
                                newNumber: 2
                            }
                        ]
                    }
                ]
            },
            {
                header: [
                    'diff --git a/testfile-renamedq b/testfile-renamedq',
                    'index 83956ed..74ab465 100644',
                    '--- a/testfile-renamedq',
                    '+++ b/testfile-renamedq'
                ],
                newName: 'testfile-renamedq',
                oldName: 'testfile-renamedq',
                chunks: [
                    {
                        header: '@@ -1,8 +1,20 @@',
                        lines: [
                            {
                                type: 'context',
                                content: ' Lets see...',
                                oldNumber: 1,
                                newNumber: 1
                            },
                            { type: 'context', content: ' ', oldNumber: 2, newNumber: 2 },
                            {
                                type: 'insert',
                                content: '+fdkjghskfdjhglskjdfhglksjhfglksjhdfgl',
                                oldNumber: undefined,
                                newNumber: 3
                            },
                            {
                                type: 'insert',
                                content: '+sfkgjhsdflkgjshdflg',
                                oldNumber: undefined,
                                newNumber: 4
                            },
                            {
                                type: 'insert',
                                content: '+sdfkgjhsdflgkhjs',
                                oldNumber: undefined,
                                newNumber: 5
                            },
                            {
                                type: 'insert',
                                content: '+lksdfjhgsldf',
                                oldNumber: undefined,
                                newNumber: 6
                            },
                            { type: 'insert', content: '+', oldNumber: undefined, newNumber: 7 },
                            { type: 'context', content: ' ', oldNumber: 3, newNumber: 8 },
                            {
                                type: 'context',
                                content: ' Some totally new content',
                                oldNumber: 4,
                                newNumber: 9
                            },
                            { type: 'context', content: ' ', oldNumber: 5, newNumber: 10 },
                            {
                                type: 'context',
                                content: ' Oops, forgot something',
                                oldNumber: 6,
                                newNumber: 11
                            },
                            { type: 'context', content: ' ', oldNumber: 7, newNumber: 12 },
                            {
                                type: 'delete',
                                content:
                                    '-ksdjhfkjsafhglakjfdhglakjhdgflkajhdlfkjahdlfkjhaldksjfhaldkjshfla',
                                oldNumber: 8,
                                newNumber: undefined
                            },
                            {
                                type: 'pseudo-context',
                                content: '\\ No newline at end of file',
                                oldNumber: undefined,
                                newNumber: undefined
                            },
                            {
                                type: 'insert',
                                content:
                                    '+ksdjhfkjsafhglakjfdhglakjhdgflkajhdlfkjahdlfkjhaldksjfhaldkjshfla',
                                oldNumber: undefined,
                                newNumber: 13
                            },
                            { type: 'insert', content: '+', oldNumber: undefined, newNumber: 14 },
                            { type: 'insert', content: '+', oldNumber: undefined, newNumber: 15 },
                            { type: 'insert', content: '+', oldNumber: undefined, newNumber: 16 },
                            {
                                type: 'insert',
                                content: '+fgkjsdfhgkljsdfhglksjhdfglskjhdflgksjhdfg',
                                oldNumber: undefined,
                                newNumber: 17
                            },
                            {
                                type: 'insert',
                                content: '+sdfglskdfjhgslkdfjhgslkdfg',
                                oldNumber: undefined,
                                newNumber: 18
                            },
                            {
                                type: 'insert',
                                content: '+ldfgjdöcv',
                                oldNumber: undefined,
                                newNumber: 19
                            },
                            {
                                type: 'insert',
                                content: '+dfjkvhsldfkj gadlfkvhgspi uhagqewpufgzh p',
                                oldNumber: undefined,
                                newNumber: 20
                            },
                            {
                                type: 'pseudo-context',
                                content: '\\ No newline at end of file',
                                oldNumber: undefined,
                                newNumber: undefined
                            }
                        ]
                    }
                ]
            }
        ] as FileDiff[]);
    });
    it('parses newly added files correctly', () => {
        const diffString =
            'diff --git a/renameTest-renamed b/renameTest-renamed\n' +
            'new file mode 100644\n' +
            'index 0000000..79dc437\n' +
            '--- /dev/null\n' +
            '+++ b/renameTest-renamed\n' +
            '@@ -0,0 +1 @@\n' +
            '+sdfgskjdfhgkjhsdfkgjshdfg\n' +
            '\\ No newline at end of file\n';
        const parsedDiff = parse(diffString);
        expect(parsedDiff).toStrictEqual([
            {
                header: [
                    'diff --git a/renameTest-renamed b/renameTest-renamed',
                    'new file mode 100644',
                    'index 0000000..79dc437',
                    '--- /dev/null',
                    '+++ b/renameTest-renamed'
                ],
                newName: 'renameTest-renamed',
                oldName: '',
                chunks: [
                    {
                        header: '@@ -0,0 +1 @@',
                        lines: [
                            {
                                content: '+sdfgskjdfhgkjhsdfkgjshdfg',
                                type: 'insert',
                                newNumber: 1,
                                oldNumber: undefined
                            },
                            {
                                content: '\\ No newline at end of file',
                                type: 'pseudo-context',
                                newNumber: undefined,
                                oldNumber: undefined
                            }
                        ]
                    }
                ]
            }
        ] as FileDiff[]);
    });
});
