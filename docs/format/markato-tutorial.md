# Markato Tutorial (as provided by user)

## Lyrics and Chords

The chords for a particular lyric line go above the lyric line. Chord lines begin with a `:` and list the chords separated by spaces. Lyric lines contain text with `^`s to indicate where the corresponding chords fall in the lyrics. Markato will automatically format the chords based on the `^` placement so that they line up. Chords can go at the beginning of a word, in the middle of a word, or before or between words. For example:

```
:C D G Em
^ I wanna ^hold your ^ha^nd
```

## Sections

Markato lets you define sections of your song using `#`. Section names are not predefined and can be whatever you want. First, let's define a section called `CHORUS`:

```
#CHORUS
:C D G Em
^ I wanna ^hold your ^ha^nd
:C D G
^ I wanna ^hold your ^hand
```

You can repeat the entire chorus just by typing `#CHORUS` again.

```
#CHORUS
:C D G Em
^ I wanna ^hold your ^ha^nd
:C D G
^ I wanna ^hold your ^hand

#CHORUS
```

If you want to repeat a section with the same chords and different lyrics, just write the new lyrics with the appropriate `^`s and Markato will render the chords automatically.

```
#VERSE
:G D
Oh yeah, ^I'll tell you ^something
:Em Bm
^ I think you'll under^stand
:G D
When ^I'll say that ^something
:Em B
^ I wanna hold your h^and

#VERSE
Oh ^please, say to ^me
^ You'll let me be your ^man
And ^please, say to ^me
^ You'll let me hold your h^and
```

You can also repeat some parts of a previous section but substitute others. Just redefine what you want to be different and everything else will be the same. If you want to reuse some but not all chords in a particular line, use `*`.

```
#CHORUS
:C D G Em
^ I wanna ^hold your ^ha^nd
:C D G
^ I wanna ^hold your ^hand

#CHORUS
^ I wanna ^hold your ^ha^nd
:* * B
^ I wanna ^hold your ^hand
```

## Playback

When you are in playback mode, you will see a green box around the current chord. Pressing spacebar will play the current chord. Use the left and right arrow keys to navigate between chords or click a chord to jump to it.

## Transposition

Click the blue arrows next to your song title to transpose it up or down or click the key itself to select a new key. Note: transposing will not change the actual key your song is written in, just the key it is outputted in.

## Comments

Comment lines begin with `##` and are not displayed in the output.

```
#CHORUS
:C D G Em
^ I wanna ^hold your ^ha^nd
## The word "hand" here is really drawn out
:C D G
^ I wanna ^hold your ^hand
```

Special comments (displayed as song info):

```
##TITLE  I Wanna Hold Your Hand
##ARTIST The Beatles
##ALBUM  A Hard Day's Night
##KEY    G
```

## Alternates

Alternates allow multiple options for a particular chord. Written at the end of a song, after a line containing `###`. An alternate for a chord applies to all instances of that chord. To single out particular instances, denote them with `'` (or `''`, `'''` for multiple conflicts).

```
:G' G C G
^ It's been a ^hard ^day's ^night

###
G  => G7
G' => G7sus4, D7sus4, Dm11
```
