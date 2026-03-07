"use client"

/**
 * Code128B barcode SVG renderer.
 * Encodes ASCII 32–126 using the Code 128B character set.
 */

// Each pattern is 6 alternating bar/space widths (bar, space, bar, space, bar, space)
// Total module width per character = 11 (except stop = 13 with final bar)
const CODE128B_PATTERNS: number[][] = [
  [2,1,2,2,2,2], // 0
  [2,2,2,1,2,2], // 1
  [2,2,2,2,2,1], // 2
  [1,2,1,2,2,3], // 3
  [1,2,1,3,2,2], // 4
  [1,3,1,2,2,2], // 5
  [1,2,2,2,1,3], // 6
  [1,2,2,3,1,2], // 7
  [1,3,2,2,1,2], // 8
  [2,2,1,2,1,3], // 9
  [2,2,1,3,1,2], // 10
  [2,3,1,2,1,2], // 11
  [1,1,2,2,3,2], // 12
  [1,2,2,1,3,2], // 13
  [1,2,2,2,3,1], // 14
  [1,1,3,2,2,2], // 15
  [1,2,3,1,2,2], // 16
  [1,2,3,2,2,1], // 17
  [2,2,3,2,1,1], // 18
  [2,2,1,1,3,2], // 19
  [2,2,1,2,3,1], // 20
  [2,1,3,2,1,2], // 21
  [2,2,3,1,1,2], // 22
  [3,1,2,1,3,1], // 23
  [3,1,1,2,2,2], // 24
  [3,2,1,1,2,2], // 25
  [3,2,1,2,2,1], // 26
  [3,1,2,2,1,2], // 27
  [3,2,2,1,1,2], // 28
  [3,2,2,2,1,1], // 29
  [2,1,2,1,2,3], // 30
  [2,1,2,3,2,1], // 31
  [2,3,2,1,2,1], // 32
  [1,1,1,3,2,3], // 33
  [1,3,1,1,2,3], // 34
  [1,3,1,3,2,1], // 35
  [1,1,2,3,1,3], // 36
  [1,3,2,1,1,3], // 37
  [1,3,2,3,1,1], // 38
  [2,1,1,3,1,3], // 39
  [2,3,1,1,1,3], // 40
  [2,3,1,3,1,1], // 41
  [1,1,2,1,3,3], // 42
  [1,1,2,3,3,1], // 43
  [1,3,2,1,3,1], // 44
  [1,1,3,1,2,3], // 45
  [1,1,3,3,2,1], // 46
  [1,3,3,1,2,1], // 47
  [3,1,3,1,2,1], // 48
  [2,1,1,3,3,1], // 49
  [2,3,1,1,3,1], // 50
  [2,1,3,1,1,3], // 51
  [2,1,3,3,1,1], // 52
  [2,1,3,1,3,1], // 53
  [3,1,1,1,2,3], // 54
  [3,1,1,3,2,1], // 55
  [3,3,1,1,2,1], // 56
  [3,1,2,1,1,3], // 57
  [3,1,2,3,1,1], // 58
  [3,3,2,1,1,1], // 59
  [3,1,4,1,1,1], // 60
  [2,2,1,4,1,1], // 61
  [4,3,1,1,1,1], // 62
  [1,1,1,2,2,4], // 63
  [1,1,1,4,2,2], // 64
  [1,2,1,1,2,4], // 65
  [1,2,1,4,2,1], // 66
  [1,4,1,1,2,2], // 67
  [1,4,1,2,2,1], // 68
  [1,1,2,2,1,4], // 69
  [1,1,2,4,1,2], // 70
  [1,2,2,1,1,4], // 71
  [1,2,2,4,1,1], // 72
  [1,4,2,1,1,2], // 73
  [1,4,2,2,1,1], // 74
  [2,4,1,2,1,1], // 75
  [2,2,1,1,1,4], // 76
  [4,1,3,1,1,1], // 77
  [2,4,1,1,1,2], // 78
  [1,3,4,1,1,1], // 79
  [1,1,1,2,4,2], // 80
  [1,2,1,1,4,2], // 81
  [1,2,1,2,4,1], // 82
  [1,1,4,2,1,2], // 83
  [1,2,4,1,1,2], // 84
  [1,2,4,2,1,1], // 85
  [4,1,1,2,1,2], // 86
  [4,2,1,1,1,2], // 87
  [4,2,1,2,1,1], // 88
  [2,1,2,1,4,1], // 89
  [2,1,4,1,2,1], // 90
  [4,1,2,1,2,1], // 91
  [1,1,1,1,4,3], // 92
  [1,1,1,3,4,1], // 93
  [1,3,1,1,4,1], // 94
  [1,1,4,1,1,3], // 95
  [1,1,4,3,1,1], // 96
  [4,1,1,1,1,3], // 97
  [4,1,1,3,1,1], // 98
  [1,1,3,1,4,1], // 99
  [1,1,4,1,3,1], // 100
  [3,1,1,1,4,1], // 101
  [4,1,1,1,3,1], // 102
  [2,1,1,4,1,2], // 103 (Start A)
  [2,1,1,2,1,4], // 104 (Start B)
  [2,1,1,2,3,2], // 105 (Start C)
]

// Stop pattern has 7 elements (13 modules)
const STOP_PATTERN = [2, 3, 3, 1, 1, 1, 2]

const START_B = 104

function encodeCode128B(text: string): number[][] {
  const codes: number[] = [START_B]

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i)
    if (charCode < 32 || charCode > 126) {
      // Replace unsupported characters with space
      codes.push(0)
    } else {
      codes.push(charCode - 32)
    }
  }

  // Calculate checksum
  let checksum = codes[0]
  for (let i = 1; i < codes.length; i++) {
    checksum += i * codes[i]
  }
  checksum = checksum % 103
  codes.push(checksum)

  // Convert to patterns
  const patterns = codes.map((code) => CODE128B_PATTERNS[code])
  return patterns
}

interface BarcodeProps {
  value: string
  width?: number
  height?: number
}

export function Barcode({ value, width = 300, height = 80 }: BarcodeProps) {
  const patterns = encodeCode128B(value)

  // Calculate total modules for sizing
  let totalModules = 10 // quiet zone left
  for (const pattern of patterns) {
    for (const w of pattern) {
      totalModules += w
    }
  }
  // Stop pattern
  for (const w of STOP_PATTERN) {
    totalModules += w
  }
  totalModules += 10 // quiet zone right

  const moduleWidth = width / totalModules
  const bars: Array<{ x: number; w: number }> = []
  let x = 10 * moduleWidth // start after quiet zone

  // Draw character patterns
  for (const pattern of patterns) {
    for (let i = 0; i < pattern.length; i++) {
      const w = pattern[i] * moduleWidth
      if (i % 2 === 0) {
        // Even index = bar (black)
        bars.push({ x, w })
      }
      x += w
    }
  }

  // Draw stop pattern
  for (let i = 0; i < STOP_PATTERN.length; i++) {
    const w = STOP_PATTERN[i] * moduleWidth
    if (i % 2 === 0) {
      bars.push({ x, w })
    }
    x += w
  }

  const textY = height + 14

  return (
    <svg
      width={width}
      height={height + 20}
      viewBox={`0 0 ${width} ${height + 20}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`Barcode: ${value}`}
    >
      <rect x="0" y="0" width={width} height={height + 20} fill="white" />
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={bar.x}
          y={0}
          width={bar.w}
          height={height}
          fill="black"
        />
      ))}
      <text
        x={width / 2}
        y={textY}
        textAnchor="middle"
        fontSize="12"
        fontFamily="monospace"
        fill="black"
      >
        {value}
      </text>
    </svg>
  )
}
